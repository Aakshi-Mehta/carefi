/**
 * Demo Data Seeder
 *
 * Populates MongoDB with clearly fictional, synthetic demo data.
 * Runs only when DEMO_MODE=true and the DB is empty.
 *
 * All data is clearly labeled as DEMO/SYNTHETIC.
 * This data does NOT represent real patients, hospitals, or insurers.
 * It must NEVER be used with real patient data.
 *
 * Patient: Aarav Sharma (PAT-1001) — fictional
 * Claim: CLM-5001 — fictional
 * Insurer: Demo Health Insurance — fictional
 * Hospital: Demo Multispeciality Hospital — fictional
 */

import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import User from './models/User';
import Patient from './models/Patient';
import Claim from './models/Claim';
import DocumentModel from './models/Document';
import QueryModel from './models/Query';
import Requirement from './models/Requirement';
import Match from './models/Match';

export async function seedDemoData(): Promise<void> {
  // Check if data already exists
  const userCount = await User.countDocuments();
  if (userCount > 0) {
    console.log('[Seed] Database already seeded — skipping');
    return;
  }

  console.log('[Seed] Seeding demo data (SYNTHETIC — NOT real patient data)...');

  // ---- Admin user ----
  const adminHash = await bcrypt.hash('Admin@123456', 12);
  await User.create({
    userId: 'USR-ADMIN001',
    email: 'admin@demo.revnow.local',
    passwordHash: adminHash,
    name: 'Demo Administrator',
    role: 'admin',
  });
  console.log('[Seed] Admin user: admin@demo.revnow.local / Admin@123456');

  // ---- Patients (fictional) ----
  const patients = [
    { patientId: 'PAT-1001', name: 'Aarav Sharma', phone: '+919876500001', email: 'aarav.sharma@demo.local' },
    { patientId: 'PAT-1002', name: 'Priya Mehta', phone: '+919876500002', email: 'priya.mehta@demo.local' },
    { patientId: 'PAT-1003', name: 'Rohan Verma', phone: '+919876500003', email: 'rohan.verma@demo.local' },
  ];

  await Patient.insertMany(patients.map((p) => ({ ...p, dateOfBirth: new Date('1985-06-15') })));

  // ---- Claims (fictional) ----
  const claims = [
    { claimId: 'CLM-5001', patientId: 'PAT-1001', insurer: 'Demo Health Insurance', hospital: 'Demo Multispeciality Hospital', status: 'QUERY_RECEIVED' },
    { claimId: 'CLM-5002', patientId: 'PAT-1002', insurer: 'Demo Health Insurance', hospital: 'Demo Multispeciality Hospital', status: 'DOCUMENTS_PENDING' },
    { claimId: 'CLM-5003', patientId: 'PAT-1003', insurer: 'Demo Care Insurance', hospital: 'Demo General Hospital', status: 'OPEN' },
  ];

  await Claim.insertMany(claims);

  // ---- Documents for PAT-1001 / CLM-5001 (fictional) ----
  const docs = [
    {
      documentId: 'DOC-DEMO001',
      patientId: 'PAT-1001',
      claimId: 'CLM-5001',
      fileName: '[DEMO] Discharge_Summary_Aarav_Sharma.pdf',
      category: 'DISCHARGE_SUMMARY',
      mimeType: 'application/pdf',
      source: 'DEMO',
      extractedText: '[DEMO SYNTHETIC DOCUMENT] Patient Aarav Sharma was discharged on 10-Jan-2024. Diagnosis: Acute Appendicitis. Discharge summary prepared by Dr. Demo Physician.',
      verificationStatus: 'VERIFIED',
      fileSize: 45231,
      driveFileId: 'demo-file-001',
    },
    {
      documentId: 'DOC-DEMO002',
      patientId: 'PAT-1001',
      claimId: 'CLM-5001',
      fileName: '[DEMO] Health_Insurance_Card.pdf',
      category: 'HEALTH_INSURANCE_CARD',
      mimeType: 'application/pdf',
      source: 'DEMO',
      extractedText: '[DEMO SYNTHETIC DOCUMENT] Health Insurance Card — Policy No: DEMO-POL-001 — Member: Aarav Sharma — Insurer: Demo Health Insurance.',
      verificationStatus: 'VERIFIED',
      fileSize: 18944,
      driveFileId: 'demo-file-002',
    },
    {
      documentId: 'DOC-DEMO003',
      patientId: 'PAT-1001',
      claimId: 'CLM-5001',
      fileName: '[DEMO] Final_Hospital_Bill.pdf',
      category: 'HOSPITAL_BILL',
      mimeType: 'application/pdf',
      source: 'DEMO',
      extractedText: '[DEMO SYNTHETIC DOCUMENT] Final Hospital Bill — Patient: Aarav Sharma — Total Amount: INR 85,000 — Bill No: DEMO-BILL-2024-001.',
      verificationStatus: 'VERIFIED',
      fileSize: 62108,
      driveFileId: 'demo-file-003',
    },
    {
      documentId: 'DOC-DEMO004',
      patientId: 'PAT-1002',
      claimId: 'CLM-5002',
      fileName: '[DEMO] Discharge_Summary_Priya_Mehta.pdf',
      category: 'DISCHARGE_SUMMARY',
      mimeType: 'application/pdf',
      source: 'DEMO',
      extractedText: '[DEMO SYNTHETIC DOCUMENT] Discharge Summary — Priya Mehta — Diagnosis: Viral Fever — Discharged: 20-Dec-2023.',
      verificationStatus: 'UNVERIFIED',
      fileSize: 38421,
    },
  ];

  await DocumentModel.insertMany(docs);

  // ---- 5 varied query fixtures (fictional insurer queries) ----
  const queryFixtures = [
    {
      queryId: 'QRY-DEMO001',
      patientId: 'PAT-1001',
      claimId: 'CLM-5001',
      originalFileName: '[DEMO] Insurer_Query_CLM5001.pdf',
      originalText: `DEMO SYNTHETIC QUERY — NOT A REAL INSURER LETTER

Dear Hospital Administration,

With reference to claim CLM-5001 for patient Aarav Sharma, we have reviewed the submitted documents.

To proceed with the claim assessment, please provide the following:

1. Treating doctor's prescription
2. Investigation reports

Kindly submit the above documents within 7 working days.

Sincerely,
Demo Health Insurance Claims Team`,
      pageCount: 1,
      ocrUsed: false,
      extractionStatus: 'COMPLETED',
      matchingStatus: 'COMPLETED',
      uploadedBy: 'USR-ADMIN001',
    },
    {
      queryId: 'QRY-DEMO002',
      patientId: 'PAT-1002',
      claimId: 'CLM-5002',
      originalFileName: '[DEMO] Insurer_Query_CLM5002.pdf',
      originalText: `DEMO SYNTHETIC QUERY — NOT A REAL INSURER LETTER

Reference: CLM-5002 / Patient: Priya Mehta

We require the following documents for claim processing:

• Laboratory reports from the treating hospital
• Final itemized hospital bill
• Pharmacy bills for medicines prescribed during admission

Please submit the above at the earliest.

Demo Health Insurance — Query Department`,
      pageCount: 1,
      ocrUsed: false,
      extractionStatus: 'COMPLETED',
      matchingStatus: 'PENDING',
      uploadedBy: 'USR-ADMIN001',
    },
    {
      queryId: 'QRY-DEMO003',
      patientId: 'PAT-1001',
      claimId: 'CLM-5001',
      originalFileName: '[DEMO] Insurer_Follow_Up_Query.pdf',
      originalText: `DEMO SYNTHETIC QUERY — NOT A REAL INSURER LETTER

Follow-up Query — CLM-5001

Further to our previous communication, we require the following additional documents:

a) MRI scan report or CT scan report
b) Treating physician's clinical notes
c) Pre-authorization approval letter

These documents are required for complete assessment.`,
      pageCount: 2,
      ocrUsed: false,
      extractionStatus: 'PENDING',
      matchingStatus: 'PENDING',
      uploadedBy: 'USR-ADMIN001',
    },
    {
      queryId: 'QRY-DEMO004',
      patientId: 'PAT-1003',
      claimId: 'CLM-5003',
      originalFileName: '[DEMO] General_Hospital_Query.pdf',
      originalText: `DEMO SYNTHETIC QUERY — NOT A REAL INSURER LETTER

Re: Insurance Claim — Rohan Verma

As part of our standard claim verification process, we require:

1. Indoor case papers / admission record from the hospital
2. Government-issued identity proof of the patient
3. Discharge summary duly signed by the treating doctor

Kindly ensure documents are legible and complete.`,
      pageCount: 1,
      ocrUsed: false,
      extractionStatus: 'PENDING',
      matchingStatus: 'PENDING',
      uploadedBy: 'USR-ADMIN001',
    },
    {
      queryId: 'QRY-DEMO005',
      patientId: 'PAT-1001',
      claimId: 'CLM-5001',
      originalFileName: '[DEMO] Surgical_Claim_Query.pdf',
      originalText: `DEMO SYNTHETIC QUERY — NOT A REAL INSURER LETTER

Surgical Claim Query — CLM-5001

For your surgical claim, the following documents must be submitted:

- Operation Theatre notes
- Anaesthesiologist's certificate
- Histopathology report / biopsy report
- Pre-operative investigation reports

Note: All documents must be originals or certified copies.`,
      pageCount: 1,
      ocrUsed: false,
      extractionStatus: 'PENDING',
      matchingStatus: 'PENDING',
      uploadedBy: 'USR-ADMIN001',
    },
  ];

  await QueryModel.insertMany(queryFixtures);

  // ---- Requirements for QRY-DEMO001 (already extracted) ----
  const requirements = [
    {
      requirementId: 'REQ-DEMO001',
      queryId: 'QRY-DEMO001',
      originalText: "Treating doctor's prescription",
      normalizedCategory: 'PRESCRIPTION',
      evidence: "To proceed with the claim assessment, please provide the following:\n1. Treating doctor's prescription",
      sourcePage: 1,
      confidence: 0.9,
      status: 'MISSING',
      reviewStatus: 'APPROVED',
    },
    {
      requirementId: 'REQ-DEMO002',
      queryId: 'QRY-DEMO001',
      originalText: 'Investigation reports',
      normalizedCategory: 'INVESTIGATION_REPORT',
      evidence: 'To proceed with the claim assessment, please provide the following:\n2. Investigation reports',
      sourcePage: 1,
      confidence: 0.88,
      status: 'MISSING',
      reviewStatus: 'APPROVED',
    },
  ];

  const savedRequirements = await Requirement.insertMany(requirements);

  // ---- Matches for QRY-DEMO001 ----
  const prescriptionRequirement = savedRequirements.find((item) => item.requirementId === 'REQ-DEMO001');
  const investigationRequirement = savedRequirements.find((item) => item.requirementId === 'REQ-DEMO002');
  if (!prescriptionRequirement || !investigationRequirement) {
    throw new Error('Failed to seed demo query requirements');
  }

  await Match.insertMany([
    {
      requirementId: String(prescriptionRequirement._id),
      documentId: undefined,
      matchReason: 'No document found in category: PRESCRIPTION. Searched 3 document(s) for patient PAT-1001. None matched category "PRESCRIPTION" or compatible categories.',
      evidence: 'Patient has 3 documents: DISCHARGE_SUMMARY, HEALTH_INSURANCE_CARD, HOSPITAL_BILL. None are in PRESCRIPTION category.',
      confidence: 0,
      status: 'MISSING',
    },
    {
      requirementId: String(investigationRequirement._id),
      documentId: undefined,
      matchReason: 'No document found in category: INVESTIGATION_REPORT. Searched 3 document(s) for patient PAT-1001. None matched category "INVESTIGATION_REPORT" or compatible categories.',
      evidence: 'Patient has 3 documents: DISCHARGE_SUMMARY, HEALTH_INSURANCE_CARD, HOSPITAL_BILL. None are in INVESTIGATION_REPORT, DIAGNOSTIC_REPORT, or LAB_REPORT category.',
      confidence: 0,
      status: 'MISSING',
    },
  ]);

  console.log('[Seed] ✅ Demo data seeded successfully');
  console.log('[Seed] ⚠️  ALL DATA IS SYNTHETIC — NOT for use with real patients');
  console.log('[Seed] Default admin: admin@demo.revnow.local / Admin@123456');
}
