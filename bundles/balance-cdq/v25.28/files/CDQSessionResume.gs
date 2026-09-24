// Reuse an already authenticated session; a device token alone never unlocks it.
function reprendreSessionCourteCDQV2524(jetonSession, jetonAppareil) {
  const token = String(jetonSession || '').trim();
  const props = PropertiesService.getScriptProperties();
  let record;
  try { record = JSON.parse(props.getProperty(cleProprieteSessionRpcCDQ_(token)) || 'null'); } catch (_) {}
  const now = Date.now();
  if (!token || !record || now - Number(record.lastSeen || record.createdAt || 0) > 30 * 60 * 1000 || Number(record.expiresAt || 0) <= now)
    return {autorise:false};
  const device = lireUtilisateurDepuisJetonAppareilCDQ_(jetonAppareil);
  if (!device || normaliserEmailCDQ_(device.email) !== normaliserEmailCDQ_(record.email)) return {autorise:false};
  const user = lireUtilisateurDepuisSessionRpcCDQ_(token);
  if (!user) return {autorise:false};
  return cdqStartupCachedV2527_({autorise:true, email:user.email, role:user.role, jetonSession:token});
}
