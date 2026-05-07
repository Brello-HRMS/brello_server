# 1. 🧠 What You’re Designing

A **guided step-by-step flow** where HR:

1. Selects leave year
2. Defines total leave
3. Distributes it into leave types
4. Sets rules

---

## 🎯 Key UX Requirement

Even though this is a stepper:

> 🔥 **User must always see Total Leave + Allocation status**
> 

👉 This is critical

---

# 2. 🧭 Overall Structure

---

## Stepper Steps

```
Step 1 — Leave Year
Step 2 — Total Leave
Step 3 — Leave Types (Allocation)
Step 4 — Rules
Step 5 — Review & Save
```

---

## 🔥 Persistent Header (VERY IMPORTANT)

Show at top in ALL steps:

### Content:

- **Total Leave: 24 days**
- **Allocated: 18 / 24 days**

---

## Behavior

- Updates in real-time across steps
- Before Step 2 → show placeholder:
    - “Total Leave not set”

---

# 3. 🟩 STEP 1 — LEAVE YEAR

---

## UI

- Dropdown: Month (Jan–Dec)

---

## Below Field

> “Leave cycle: Apr 1 – Mar 31”
> 

---

## CTA

- Next

---

# 4. 🔢 STEP 2 — TOTAL LEAVE

---

## UI

- Input: Number
- Label: **Total Leave**
- Unit: days

---

## Example

`[ 24 ] days`

---

## Helper Text

> “Total leave available per year”
> 

---

## Behavior

- Updates persistent header instantly

---

## CTA

- Back
- Next

---

# 5. 🧩 STEP 3 — LEAVE TYPES (CORE STEP)

---

## 🧠 Goal

User distributes total leave into types

---

## Layout

- List of leave type rows/cards

---

## Default Types

- Casual Leave
- Sick Leave
- Earned Leave

---

## Each Row

- Leave Name (input)
- Days (input)
- Accrual (dropdown: None / Monthly)
- Half Day toggle

---

## 🔥 Allocation Indicator (INSIDE STEP)

### Show clearly:

> **Allocated: 18 / 24 days**
> 

---

## States

### 🟢 Exact

> 24 / 24 days
> 
> 
> “All leave allocated”
> 

---

### 🟡 Under

> 18 / 24 days
> 
> 
> “6 days remaining”
> 

---

### 🔴 Over

> 26 / 24 days
> 
> 
> “Exceeded total leave”
> 

---

## ➕ Add Leave Type

Button: **+ Add Leave Type**

---

## CTA Behavior

### Next button:

- ❌ Disabled until:

> Allocated = Total Leave
> 

---

## Inline Error

> “Total allocated leave must equal total leave”
> 

---

# 6. ⚙️ STEP 4 — RULES

---

## Layout

Simple vertical list

---

## Fields

### 1. Approval Required

- Toggle

---

### 2. Max Leaves Per Month

- Number input

---

### 3. Allow Half Day

- Toggle

---

### 4. Backdated Leave

- Toggle
- If ON:
    - Show “Max backdated days”

---

### 5. Sandwich Rule

- Toggle

Tooltip:

> “If leave is taken before and after weekends/holidays, those days may be counted as leave”
> 

---

## CTA

- Back
- Next

---

# 7. 📋 STEP 5 — REVIEW & SAVE

---

## Sections

---

### 1. Leave Year

- Apr – Mar

---

### 2. Total Leave

- 24 days

---

### 3. Leave Types

| Type | Days |
| --- | --- |

---

### 4. Rules Summary

- Approval Required
- Max per month
- Half Day
- Backdated Leave
- Sandwich Rule

---

## CTA

👉 **Save Configuration**

---

# 8. 🚨 VALIDATION RULES

---

## Step 2

- Total leave required
- Must be > 0

---

## Step 3 (Critical)

- Allocated must equal total

---

## Save

- All steps completed

---

# 9. 🔄 EDIT FLOW

---

- Same stepper
- Pre-filled data
- User can jump between steps

---

## Special Case

If total leave is reduced:

- And allocation exceeds total
- Header
- Step 3

---

# 10. 🚫 DO NOT DESIGN

---

- Policies
- Policy assignment
- Unpaid leave config
- Future leave limit
- Weekly off / holiday toggles

---

# 11. 🎯 DESIGN GUIDELINES

---

## 1. Keep Steps Light

- Each step should feel quick

---

## 2. Highlight Allocation

- Always visible (header + step)

---

## 3. Prevent Errors Early

- Disable Next when invalid

---

## 4. Clear Navigation

- Back + Next always visible

---

## 5. Progress Visibility

- Show step count (e.g., Step 2 of 5)

---

# ✅ FINAL DESIGN CHECK

---

- Can user understand allocation while on Step 3?
- Is total leave always visible?
- Is it impossible to proceed with wrong allocation?
- Does the flow feel guided and quick?

---