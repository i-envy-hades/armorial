# Turning on online accounts (Firebase) — about 15 minutes

Until you do this, the site works exactly as before: profiles and scores stay in each visitor's browser.
Nothing here costs money and no payment card is asked for (stay on the free **Spark** plan: never click *Upgrade*).
You do steps 1–5 yourself (they need your own Google login); step 6 is two values that Claude can paste into one file.

## 1. Create the Firebase project

1. Go to <https://console.firebase.google.com> and sign in with a Google account.
2. **Create a project** (or *Add project*). Name: `armorial`.
3. **Google Analytics: turn it off** (not needed), then **Create project**. Wait until it is ready, then *Continue*.

## 2. Turn on e-mail + password sign-in

Left menu → **Build → Authentication** → **Get started** → tab **Sign-in method** → **Email/Password**:
switch on the **first** toggle (*Email/Password*), leave *Email link* off → **Save**.

## 3. Create the database and publish the rules

1. Left menu → **Build → Firestore Database** → **Create database**.
2. Edition: **Standard**. Location: choose a **European** one (for example `eur3 (Europe)`) — it cannot be changed later.
3. Mode: **Start in production mode** → **Create**.
4. Open the **Rules** tab. Select everything in the editor and delete it. Open [`firestore.rules`](firestore.rules) in this folder, copy **all** of it, paste it, click **Publish**.
   (If the editor shows a red error, tell Claude the exact message: it is a rule I need to adjust.)

## 4. Copy the two values

Click the **gear** next to *Project Overview* → **Project settings** → tab **General**:

- **Project ID**, like `armorial-a1b2c`
- **Web API Key**, starting with `AIza…`

If *Web API Key* is not shown, scroll to *Your apps*, click the web icon **`</>`**, register an app named `armorial`
(do **not** tick Hosting), and copy `projectId` and `apiKey` from the snippet it displays.

Both values are *meant* to be public: they ship inside the web page, and the rules from step 3 are what protect the data.

## 5. (Recommended) Add the leaderboard index, and lock the key to your site

**Index** — makes the daily leaderboard read 10 documents instead of up to 100 (the free plan has a daily reading quota):
Firestore Database → tab **Indexes** → **Composite** → **Add index**: collection ID `scores`; fields `vic` Ascending,
`essais` Ascending, `cree` Ascending; query scope *Collection* → **Create**. It takes a few minutes. Then add `"index": true`
to `data/compte.json` (step 6). Without the index everything still works, just with more reads.

**Key restriction** — so nobody can reuse your key on another site: <https://console.cloud.google.com/apis/credentials>
(same Google login, same project) → open the key named *Browser key* (auto created by Firebase) → *Application restrictions* →
**Websites** → add `https://armorial.web.app/*`, `https://armorial-175d5.web.app/*` and `http://localhost:*` (local tests) → **Save**.
(Add `https://i-envy-hades.github.io/*` too only while the old GitHub address is still in use; it now redirects to `armorial.web.app`.)

## 6. Put the values in the site

Paste the two values in the chat and Claude fills `data/compte.json` — or edit it yourself:

```json
{
 "projet": "armorial-a1b2c",
 "cle": "AIzaSy...",
 "index": true
}
```

(`"index": true` only if you created the index of step 5.)

Then commit and push, as for any change. To check it works, open `jeu.html`, click **Créer mon profil**, pick a pseudo, and at
the bottom of the window use **Compte en ligne** to create an account; play, and your result appears in the **Classement** card.
You can see the data in Firebase → Firestore Database → *Data* (`profils`, `pseudos`, `scores`) and the users in Authentication → *Users*.

## Good to know

- **Free plan quotas** (Spark): about 50,000 document reads and 20,000 writes per day, 1 GiB stored, and no pausing of the project.
  A visit costs a few dozen reads (the leaderboard is cached for 30 seconds in the tab), a finished game about 4 writes.
  If a quota is ever exceeded, Firestore refuses requests until the next day: the game itself keeps working (local mode), only sync and leaderboard pause.
- **Passwords** are handled by Firebase Authentication (hashed); the site never sees or stores them. There is no "forgot password"
  button yet; you can send a reset mail by hand from Authentication → *Users* → ⋮ → *Reset password*.
- **Privacy.** Stored online: e-mail (visible only in your Firebase console, never shown on the site), pseudo, player arms,
  scores. Players can delete their online account from their profile window (it asks for the password again): that erases the documents and the account.
  Data is held by Google (Firebase); the privacy note in the page footer says so.
- **Pseudos** are unique, ignoring capitals (2–24 letters/digits/space/`_`/`.`/`-`): one small document per pseudo does that.
- **Cheating.** Scores come from the player's browser, so a determined person can fake one. For a friendly leaderboard that is
  fine; the rules at least keep each person to their own documents and make a day's result impossible to modify.
- **Trying without a project.** `python3 tools/firebase/mock_firebase.py` starts a fake Firebase in memory
  (then open <http://127.0.0.1:8130/jeu.html>): it proves the site's logic, not Firebase's.
- **Turn it off** at any time by emptying `data/compte.json` (both values `""`): the site goes back to local-only.
