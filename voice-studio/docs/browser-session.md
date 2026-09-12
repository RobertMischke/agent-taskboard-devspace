# Browser sessions and local pairing

Open the local Studio app at `http://127.0.0.1:5188/` and enter the current
pairing code. **Remember this browser for 7 days** is selected by default.
After pairing, reloads, new tabs and reopening that browser can resume the session.
Use **Log out** to revoke this browser's saved access.

```sh
npm run pairing-code
```

Run the command in the Voice Studio workspace if the startup code has scrolled
out of the terminal. It prints only the installation's current pairing code.
It does not print the API bearer token.

## What is remembered

The browser receives an opaque, HttpOnly, SameSite=Strict, host-only cookie
restricted to `/api/session`. The local backend stores only the credential's hash,
its exact origin and its creation and expiry timestamps in the private
`trusted-browsers.json` file. This registry is outside the reviewed repository.
The bearer token used for ordinary API requests remains in browser memory.
The cookie by itself cannot authorize project API operations.

The lifetime is seven days from pairing. Reloading does not extend that deadline.
The saved trust survives a backend restart; resume obtains a valid in-memory
bearer again. The loopback HTTP cookie is not marked Secure because this local
installation serves HTTP. This is a local app session design, not a hosted login
service.

## Address and browser scope

Keep using the same browser profile and app address. `localhost` and `127.0.0.1`
are distinct hosts; the port is part of the exact origin binding too. A different
profile, private browsing session, cleared site data or expired credential needs
pairing again. Leaving the checkbox unchecked creates a temporary in-memory
session: a page reload requires the code again.

## HTTP contract

| Request | Input and outcome |
| --- | --- |
| `POST /api/session/pair` | `{ code, remember }`; returns `{ token, remembered, expiresAt }` and sets browser trust when requested |
| `POST /api/session/resume` | Saved session cookie; returns a valid bearer and the original expiry, or HTTP 200 `{ paired: false }` for absent/expired/revoked trust |
| `POST /api/session/logout` | Revokes this browser's credential and associated active bearer; expires its cookie |

Resume, logout and pairing with `remember: true` require the exact local
`Origin` and `X-Voice-Studio-Session: 1`. Temporary CLI pairing with
`remember: false` also works without those browser headers. A page on an unrelated origin cannot resume or revoke
the session just by sending the cookie. Normal project APIs require a bearer.
The existing private CLI installation token continues to work for local tools;
it is never stored in a browser cookie or published in evidence.

The UI resumes when it starts. After a token becomes invalid, a read may resume
and retry once. Writes and model starts are **never automatically replayed**.
A definitive authentication failure returns the UI to pairing. Session-generation
guards prevent a late response from an older request from clearing a newer login.

## Verification and scope

The offline backend suite covers pairing, cookie restrictions, origin binding,
absolute expiry, restart persistence and revocation. UI state tests exercise
resume, unauthorized-response handling and late-response races.

```sh
npm run test:session
npm run test:session-ui
npm run test:browser-session
```

The real Chrome scenario uses an isolated browser profile and verifies a full
close/reopen, reload, a new tab, logout, origin rejection and temporary mode. It
does not write project source, create a proposal or start a model. This proves
the tested local Chrome workflow; it is not cross-browser or hosted-service
qualification.
