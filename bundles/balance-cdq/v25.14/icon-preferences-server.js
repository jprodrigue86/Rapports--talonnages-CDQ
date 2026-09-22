// BEGIN CDQ_ICON_PREFERENCES_V2514
// Personal navigation artwork, stored separately from legacy display settings.
function cdqIconPreferenceOwnerV2514_(expectedEmail) {
  const email = cdqV72Email_();
  if (!email || email !== String(expectedEmail || '').trim().toLowerCase()) {
    throw new Error('Le compte a changé. Rouvrez les réglages.');
  }
  return email;
}
function cdqReadIconPreferenceV2514_(email) {
  let value = {};
  try {
    value = JSON.parse(PropertiesService.getScriptProperties().getProperty('CDQ_ICON_V2514_' + cdqV72Hash_(email)) || '{}') || {};
  } catch (error) {}
  const allowed = ['current', 'minimal', 'dark-pro', 'metal-music', 'isometric'];
  return {
    email: email,
    style: allowed.indexOf(value.style) >= 0 ? value.style : 'current',
    revision: Number.isSafeInteger(value.revision) && value.revision > 0 ? value.revision : 0
  };
}
function obtenirStyleIconesCDQV2514(expectedEmail) {
  return cdqReadIconPreferenceV2514_(cdqIconPreferenceOwnerV2514_(expectedEmail));
}
function enregistrerStyleIconesCDQV2514(expectedEmail, value) {
  const email = cdqIconPreferenceOwnerV2514_(expectedEmail);
  value = value && typeof value === 'object' ? value : {};
  if (['current', 'minimal', 'dark-pro', 'metal-music', 'isometric'].indexOf(value.style) < 0 ||
      !Number.isSafeInteger(value.revision) || value.revision <= 0) {
    throw new Error('Choix d’icônes invalide.');
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const previous = cdqReadIconPreferenceV2514_(email);
    if (value.revision > previous.revision) {
      PropertiesService.getScriptProperties().setProperty('CDQ_ICON_V2514_' + cdqV72Hash_(email),
        JSON.stringify({style: value.style, revision: value.revision}));
      return {email: email, style: value.style, revision: value.revision};
    }
    return previous;
  } finally {
    lock.releaseLock();
  }
}
// END CDQ_ICON_PREFERENCES_V2514
