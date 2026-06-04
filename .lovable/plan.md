
## Reception Registration — Two Save Modes

### Behavior summary

Reception form gets **two primary actions** side-by-side:

| Button | Required fields | Result |
|---|---|---|
| **Save** | First name + Last name + Phone + DOB (18+) | Player created as `unverified`. No photos, no ID number required. Card can be issued. AM sees in "Not Verified" tab. |
| **Verify & Save** | All Save fields + ID number + Selfie + ID front + ID back | Player created as `verified`, `verified_source = 'reception'`. Card can be issued. AM sees in "Verified by Reception" tab (revocable). |

Card issuance is **never gated** by verification status — both flows can print/assign a club card.

### Club App side (unverified player logs in via OTP)

- Player sees full profile, balance, promo grants — same layout as verified.
- Persistent **"Get verified" banner** at top of `/club/profile` linking to the existing `ClubVerifyWizard`.
- KYC submission from the app feeds into the AM "Queue" tab as before.
- Once AM approves → `verified` + `verified_source = 'club_app'`; banner disappears.

### Implementation details (technical)

**Frontend — `src/pages/Reception.tsx`**
- Rename current "Verify & Save" enable rule so it stays gated on full KYC payload (unchanged).
- Add a second always-enabled primary button **"Save"** that calls the existing minimal create flow with `verification_status='unverified'` once the four base fields (first, last, phone, DOB) are present.
- Disable both buttons if DOB < 18 years; show inline hint.
- Reuse existing duplicate-phone / duplicate-ID checks.

**Frontend — `src/pages/club/ClubProfile.tsx`**
- When `wallet.player.verification_status !== 'verified'`, render a gold banner above existing content: "Complete your verification" → `nav('/club/verify')`.
- No changes to balance/grants/shop/lottery access (per user choice: full profile + KYC offer).

**Backend**
- No schema changes needed — `players.verification_status` already supports `unverified`. Existing `reception_verify_player` RPC stays for the Verify & Save path.
- For the simple Save path, reuse the existing reception player-creation flow (no RPC change).

**AM dashboard — `src/pages/admin/KycReviewsPage.tsx`**
- No change. The "Not Verified" tab already lists all `unverified` players, so the new Save-only registrations naturally land there.

### Out of scope

- No SMS sent for either path (player logs in via OTP on their own).
- No change to club-app limits, promos, lottery, or shop access for unverified.
- No change to existing AM Queue / Verified by Reception / Not Verified tabs.
