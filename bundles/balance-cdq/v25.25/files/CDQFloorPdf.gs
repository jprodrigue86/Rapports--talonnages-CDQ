// Calculations from the approved template SHA256 d386179c7186debc0f7fc17ded80133f739c15ca6f8a44407b69b6f147f5ee92.
function cdq25Results_(d) {
  var out = {}, eps = 0.0000000001;
  var rawValues = {};
  function raw(n) {
    if (rawValues.hasOwnProperty(n)) return rawValues[n];
    var f = d.getField(n), v = f ? f.value : "";
    var s = v === null || v === undefined ? "" : String(v).replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
    rawValues[n] = s;
    return s;
  }
  function num(n) { var s = raw(n), x = s === "" ? NaN : Number(s); return isFinite(x) ? x : NaN; }
  function tolerance(c, e) {
    return !isFinite(c) || !isFinite(e) || c < 0 || e <= 0 ? NaN : Math.max(1, Math.ceil(c * 0.001 / e - 0.5 - eps));
  }
  function error(m, c, e) { return !isFinite(m) || !isFinite(c) || !isFinite(e) || e <= 0 ? NaN : (m - c) / e; }
  function result(x) { if (!isFinite(x)) return ""; var y = Math.round(x * 1000) / 1000; return y === 0 ? 0 : y; }
  function check(n, on) { out[n] = on ? "Yes" : "Off"; }
  var e = num("echelon"), anyGood = false, anyBad = false;
  for (var i = 1; i <= 6; i++) {
    var p = "charge_point_" + i + "_", c = num(p + "charge_utilisee"), t = tolerance(c, e);
    var before = num(p + "avant_correction"), after = num(p + "apres_correction");
    var eb = error(before, c, e), ea = error(after, c, e);
    out[p + "tolerance"] = isFinite(t) ? t : "";
    out[p + "erreur_avant"] = result(eb);
    out[p + "erreur_apres"] = result(ea);
    var q = raw(p + "apres_correction") !== "" ? ea : eb;
    var evaluated = isFinite(q) && isFinite(t), good = evaluated && Math.abs(q) <= t + eps;
    check(p + "conforme_vert", good);
    check(p + "conforme_rouge", evaluated && !good);
    out[p + "conforme"] = evaluated ? (good ? "Conforme" : "Non conforme") : "";
    if (good) anyGood = true;
    if (evaluated && !good) anyBad = true;
  }
  check("bloc3_statut_conforme", anyGood && !anyBad);
  check("bloc3_statut_non_conforme", anyBad);
  var positions = ["arriere_gauche", "arriere_droit", "avant_gauche", "avant_droit"];
  function group(prefix) {
    var g = { any: false, complete: true, min: Infinity, max: -Infinity };
    for (var j = 0; j < 4; j++) {
      var n = "excentricite_" + prefix + "_" + positions[j], x = num(n);
      if (raw(n) !== "") g.any = true;
      if (!isFinite(x)) g.complete = false;
      else { g.min = Math.min(g.min, x); g.max = Math.max(g.max, x); }
    }
    return g;
  }
  var c4 = num("charge_excentricite"), t4 = tolerance(c4, e), b = group("avant"), a = group("apres");
  out.tolerance_excentricite = isFinite(t4) ? t4 : "";
  var g4 = false, r4 = false, limit = t4 * e;
  if (isFinite(limit)) {
    if (a.any) {
      if (a.complete) { g4 = a.max - a.min <= limit + eps * Math.max(1, Math.abs(limit)); r4 = !g4; }
    } else if (b.complete) {
      g4 = b.max - b.min <= limit + eps * Math.max(1, Math.abs(limit));
      r4 = !g4;
      // Before correction is authoritative until any after-correction value is entered.
    }
  }
  check("excentricite_statut_conforme", g4);
  check("excentricite_statut_non_conforme", r4);
  check("Bouton_Conforme", !(anyBad || r4));
  check("Bouton_NonConforme", anyBad || r4);
  out.Statut_conformite = anyBad || r4 ? "Non conforme" : "Conforme";
  return out;
}
async function cdq25FillPdf_(values){
 const lib=cdq25PdfLib_(),bytes=cdqBlobEmbarque_('plancher').getBytes();
 const doc=await lib.PDFDocument.load(new Uint8Array(bytes.map(b=>b&255)),{updateMetadata:false,parseSpeed:Infinity});
 const form=doc.getForm(),font=await doc.embedFont(lib.StandardFonts.HelveticaBold);
 const calculated=cdq25Results_({getField:n=>({value:values[n]===undefined?'':values[n]})});
 const all=Object.assign({},values,calculated);
 for(const name of Object.keys(all)){
   const field=form.getField(name),value=String(all[name]);
   if(field instanceof lib.PDFTextField){field.setText(value);field.updateAppearances(font);}
   else if(field instanceof lib.PDFDropdown){if(!field.getOptions().includes(value))field.addOptions([value]);field.select(value);field.updateAppearances(font);}
   else if(field instanceof lib.PDFCheckBox){if(value==='Yes')field.check();else field.uncheck();}
   else if(field instanceof lib.PDFRadioGroup)field.select(value);
   else throw Error('Type de champ non pris en charge : '+name);
 }
 // Never flatten: original JavaScript, widgets, headers and artwork remain editable.
 return await doc.save({objectsPerTick:Infinity,updateFieldAppearances:false,addDefaultPage:false});
}
