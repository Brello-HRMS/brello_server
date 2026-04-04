# Payroll Collection Setup

To run the full end-to-end payroll configuration, use the Postman collection sequentially:

1. **Setup Core Tenants**: Follow `GETTING_STARTED.md` to get an enterprise, organization, and auth token.
2. **Setup Payroll Rules**:
   a. Use `PUT /api/v1/payroll/configurations` to define cutoff days.
   b. Use `PUT /api/v1/payroll/statutory-pf-config` to save the PF static configuration (e.g., 12%).
3. **Master Components**: Create Earings like `Basic` and `HRA` and Deductions like `PF`. Ensure `calculation_type` correctly maps dependencies.
4. **Link to Blueprint**: Attach all components to a Salary Template via `POST /api/v1/payroll/salary-templates`. (Ensure Basic is included, else it will throw 400 Bad Request).
5. **Dry Run**: `POST /api/v1/payroll/simulations/dry-run` to visualize how your template calculates a net salary against a specific CTC.
6. **Assign**: `POST /api/v1/payroll/employee-salary-assignments` exactly materializes the current formula rules and assigns it to an employee effective from a date.
