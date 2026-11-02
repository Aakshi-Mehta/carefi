import QueryModel from '../models/Query';
import Requirement from '../models/Requirement';
import Match from '../models/Match';
import DocumentModel from '../models/Document';
import Patient from '../models/Patient';
import Claim from '../models/Claim';
import { writeAudit } from '../lib/audit';
import { extractRequirements } from './requirementExtractor';
import { matchRequirements } from './documentMatcher';
import { generateNotification } from './notificationGenerator';
import { deliverNotificationChannel } from './notificationDelivery';

export interface QueryAutomationOutcome {
  status: 'COMPLETED' | 'NEEDS_REVIEW' | 'FAILED';
  requirementCount: number;
  matchedCount: number;
  missingCount: number;
  channels: Array<{ channel: 'WHATSAPP' | 'EMAIL'; status: string; errorMessage?: string }>;
  detail?: string;
}

export async function automateQueryResponse(queryId: string, actor: string): Promise<QueryAutomationOutcome> {
  let stage: 'extraction' | 'matching' = 'extraction';
  let requirementCount = 0;
  let matchedCount = 0;
  let missingCount = 0;

  try {
    const query = await QueryModel.findOne({ queryId });
    if (!query) throw new Error('Query not found after upload');

    await QueryModel.findOneAndUpdate({ queryId }, { extractionStatus: 'PROCESSING' });
    const extracted = extractRequirements(query.originalText);
    requirementCount = extracted.length;

    if (extracted.length === 0) {
      await QueryModel.findOneAndUpdate({ queryId }, { extractionStatus: 'NEEDS_REVIEW' });
      return {
        status: 'NEEDS_REVIEW',
        requirementCount: 0,
        matchedCount: 0,
        missingCount: 0,
        channels: [],
        detail: 'No document requirements could be extracted confidently.',
      };
    }

    const requirements = await Requirement.insertMany(extracted.map((item) => ({
      requirementId: item.requirementId,
      queryId,
      originalText: item.originalText,
      normalizedCategory: item.normalizedCategory,
      evidence: item.evidence,
      sourcePage: item.sourcePage,
      confidence: item.confidence,
      status: item.isUncertain ? 'UNCERTAIN' : 'PENDING',
      reviewStatus: item.isUncertain ? 'PENDING' : 'APPROVED',
    })));

    await QueryModel.findOneAndUpdate({ queryId }, { extractionStatus: 'COMPLETED' });
    await writeAudit({
      actor,
      action: 'REQUIREMENTS_EXTRACTED',
      resourceType: 'Query',
      resourceId: queryId,
      metadata: {
        count: requirements.length,
        uncertainCount: requirements.filter((item) => item.reviewStatus === 'PENDING').length,
      },
    });

    stage = 'matching';
    await QueryModel.findOneAndUpdate({ queryId }, { matchingStatus: 'PROCESSING' });
    const [documents, patient, claim] = await Promise.all([
      DocumentModel.find({ patientId: query.patientId }),
      Patient.findOne({ patientId: query.patientId }),
      Claim.findOne({ claimId: query.claimId }),
    ]);

    if (!patient) throw new Error('Patient not found while processing query');

    const results = matchRequirements(requirements, documents, query.claimId);
    await Promise.all(results.map(async (result) => {
      await Match.findOneAndUpdate(
        { requirementId: result.requirementId },
        {
          requirementId: result.requirementId,
          documentId: result.documentId,
          matchReason: result.matchReason,
          evidence: result.evidence,
          confidence: result.confidence,
          status: result.status,
        },
        { upsert: true, new: true }
      );

      const status = result.status === 'MATCHED'
        ? 'MATCHED'
        : result.status === 'MISSING'
          ? 'MISSING'
          : 'NEEDS_REVIEW';
      await Requirement.findByIdAndUpdate(result.requirementId, { status });
    }));

    matchedCount = results.filter((result) => result.status === 'MATCHED').length;
    missingCount = results.filter((result) => result.status === 'MISSING').length;
    await QueryModel.findOneAndUpdate({ queryId }, { matchingStatus: 'COMPLETED' });
    await writeAudit({
      actor,
      action: 'DOCUMENT_MATCHED',
      resourceType: 'Query',
      resourceId: queryId,
      metadata: { matchedCount, missingCount },
    });

    const requiresReview = extracted.some((item) => item.isUncertain)
      || results.some((result) => !['MATCHED', 'MISSING'].includes(result.status));
    if (requiresReview) {
      return {
        status: 'NEEDS_REVIEW',
        requirementCount,
        matchedCount,
        missingCount,
        channels: [],
        detail: 'At least one requirement or document match is uncertain; messages were not sent.',
      };
    }

    if (missingCount === 0) {
      return {
        status: 'COMPLETED',
        requirementCount,
        matchedCount,
        missingCount,
        channels: [],
        detail: 'All requested documents are already available; no patient message was needed.',
      };
    }

    const message = generateNotification({
      patientName: patient.name,
      hospitalName: claim?.hospital || 'Care Team',
      requirements,
      matchResults: results,
    }).message;

    const deliveries = await Promise.allSettled([
      deliverNotificationChannel({
        queryId,
        claimId: query.claimId,
        patient,
        actor,
        channel: 'WHATSAPP',
        messageText: message,
      }),
      deliverNotificationChannel({
        queryId,
        claimId: query.claimId,
        patient,
        actor,
        channel: 'EMAIL',
        messageText: message,
      }),
    ]);

    const channels = deliveries.map((delivery, index) => {
      const channel: 'WHATSAPP' | 'EMAIL' = index === 0 ? 'WHATSAPP' : 'EMAIL';
      if (delivery.status === 'fulfilled') {
        return {
          channel,
          status: delivery.value.sendResult.status,
          errorMessage: delivery.value.sendResult.errorMessage,
        };
      }
      console.error(`[QueryAutomation] ${channel} delivery failed for ${queryId}:`, delivery.reason);
      return { channel, status: 'FAILED', errorMessage: 'Delivery failed; see server logs.' };
    });

    return { status: 'COMPLETED', requirementCount, matchedCount, missingCount, channels };
  } catch (error) {
    const statusUpdate = stage === 'extraction'
      ? { extractionStatus: 'FAILED' }
      : { matchingStatus: 'FAILED' };
    await QueryModel.findOneAndUpdate({ queryId }, statusUpdate).catch(() => undefined);
    console.error(`[QueryAutomation] ${stage} failed for ${queryId}:`, error);
    return {
      status: 'FAILED',
      requirementCount,
      matchedCount,
      missingCount,
      channels: [],
      detail: `Automatic ${stage} failed. The query was saved for follow-up.`,
    };
  }
}