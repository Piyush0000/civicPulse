import { q } from "./db";
import { firebaseEnabled, sendPush } from "./firebase-admin";
import { pseudonym } from "./privacy";

// Push notifications to logged-in citizens whose complaints are linked to a project.
// Reporters are stored only as pseudonyms, so we recompute the pseudonym of each citizen who opted in
// to push and match it; no reverse lookup of identities is ever stored.

export async function notifyRecommendationCitizens(recId: string, msg: (trackingCode: string) => { title: string; body: string }) {
  if (!firebaseEnabled()) return { sent: 0 };
  const subs = await q<{ user_id: string; token: string }>("SELECT user_id, token FROM push_tokens");
  if (!subs.length) return { sent: 0 };
  const byPseudonym = new Map<string, { user: string; tokens: string[] }>();
  for (const s of subs) {
    const ph = pseudonym("web", `citizen:${s.user_id}`);
    const e = byPseudonym.get(ph) ?? { user: s.user_id, tokens: [] };
    e.tokens.push(s.token);
    byPseudonym.set(ph, e);
  }
  const rows = await q<{ tracking_code: string; pseudonym_hash: string }>(
    `SELECT DISTINCT ON (rp.pseudonym_hash) r.tracking_code, rp.pseudonym_hash
       FROM requests r JOIN reporters rp ON rp.id = r.reporter_id
      WHERE r.recommendation_id=$1 AND rp.pseudonym_hash = ANY($2::text[])`,
    [recId, [...byPseudonym.keys()]],
  );
  let sent = 0;
  for (const r of rows) {
    const target = byPseudonym.get(r.pseudonym_hash)!;
    const res = await sendPush(target.tokens, { ...msg(r.tracking_code), link: `/track/${r.tracking_code}` }).catch((e) => {
      console.error("[push]", (e as Error).message);
      return { sent: 0, invalid: [] as string[] };
    });
    sent += res.sent;
    if (res.invalid.length) await q("DELETE FROM push_tokens WHERE token = ANY($1::text[])", [res.invalid]);
  }
  return { sent };
}
