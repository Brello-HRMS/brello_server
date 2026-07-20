# Brello Offer Management Lifecycle Flow

A comprehensive summary of how the entire Brello Offer Management flow operates, from candidate selection to final employee conversion.

---

### Phase 1: Candidate Creation & Offer Drafting
1. **Candidate Entry:** The journey begins in the **Candidates Module**. HR adds a candidate's personal and professional details (Name, Email, Resume, Current Salary, Applied Position).
2. **The Wizard (Drafting):** HR clicks "Create Offer," opening a 5-step wizard:
   - **Details:** Fills in the job role, joining date, reporting manager, and probation period.
   - **Compensation:** Connects directly to Brello's payroll engine. HR selects a salary structure, inputs the Annual CTC, and the system automatically calculates the monthly take-home and individual tax/allowance components.
   - **Policies:** HR selects organizational policies (e.g., Leave Policy, NDA) to attach to the offer.
   - **Preview:** The system generates a live preview of the Offer Letter HTML template, populating all variables (`{{candidate_name}}`, `{{ctc}}`, etc.).
3. **Local Storage:** While drafting, the wizard autosaves to the browser's `localStorage` (with a 7-day TTL) so HR doesn't lose their work if they accidentally close the tab.

### Phase 2: The Approval Chain (Governance)
1. **Routing:** If the organization requires approvals, the drafted offer enters a `PENDING_APPROVAL` status. It is routed to the `OFFER_APPROVALS` module queue.
2. **Approval Steps:** The offer goes through a defined chain (e.g., Manager ➔ Director ➔ Finance). Each approver logs in, reviews the compensation and details, and must either **Approve** or **Reject** (requiring a written reason).
3. **Clearance:** The offer cannot be sent to the candidate until the `current_approval_step` clears the final approver in the chain.

### Phase 3: Sending & The Candidate Portal
1. **Dispatch:** Once approved, HR clicks "Send". The system generates a PDF snapshot of the offer, attaches the policy PDFs, and emails the candidate. 
2. **Secure Token:** A cryptographically secure, time-limited access token is generated. The candidate receives an email with a magic link containing this token.
3. **The Portal:** The candidate clicks the link and is taken to an external, no-login portal. They see the offer summary, salary breakdown, and the full PDF. 
4. **Tracking:** The moment the candidate opens the portal, the backend updates the offer status to `VIEWED` and logs it in the immutable Timeline.

### Phase 4: Candidate Decision & Negotiation
The candidate has three options in the portal before the 7-day expiry (which HR can manually extend if needed):
1. **Request Changes:** The candidate asks for a higher salary or a new joining date. The status changes to `NEGOTIATING`, HR is notified, and HR can revise the offer.
2. **Version Control:** If HR revises the offer, the system creates **Version 2**. V1 is archived as a historical snapshot. The candidate's magic link dynamically updates to show V2.
3. **Reject:** The candidate rejects the offer, providing a reason. The flow ends here.
4. **Accept:** The candidate accepts the offer. The system immediately applies a digital timestamp/signature to the PDF, locking it.

### Phase 5: Preboarding & Employee Sync
1. **Document Uploads:** After acceptance, the candidate's portal transforms. They can now upload required preboarding documents (PAN card, Aadhaar, voided checks).
2. **The Final Sync:** HR reviews the accepted offer. With one click on **"Sync to Employee"**, the system extracts all the candidate's data, salary structure, and uploaded documents, and automatically provisions a new Employee profile in the core HRMS database.
3. **Completion:** The offer status changes to `SYNCED`. The recruitment cycle is officially closed, and the employee lifecycle begins.

### Behind the Scenes: The Scheduler & Analytics
- **The Cron Job:** Every day at 8 AM and 9 AM, a backend background worker wakes up. It automatically expires offers that have passed their deadline and sends automated email reminders (e.g., "Your offer expires in 3 days") to candidates who haven't responded.
- **Audit & Analytics:** Every single action—from drafting to accepting—is logged in the `OfferTimelineRepository`. This feeds the Analytics Dashboard, where HR heads can see their acceptance rates, average negotiation times, and weekly funnel drops.
