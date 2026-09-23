// Verified legacy Feuil1 layout. Never import calculated errors or tolerances.
function cdq23Norm_(s){return String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,'').replace(/\s+/g,' ').trim().toLowerCase();}
function cdq23Text_(v){var s=String(v==null?'':v).trim();return /^[-–—]+$/.test(s)?'':s;}
function cdq23ParseSheet_(rows){
 var at=function(r,c){return cdq23Text_((rows[r]||[])[c]);},find=function(test){var matches=[];rows.forEach(function(row,r){row.forEach(function(v,c){if(test(cdq23Norm_(v)))matches.push({r:r,c:c});});});return matches;};
 var types=find(function(s){return /^type\s*:$/.test(s);});
 if(!types.length)return {skip:true,reason:'Aucun type de balance renseigné.'};
 var floors=types.filter(function(p){for(var c=p.c+1;c<Math.min(p.c+12,100);c++){var v=at(p.r,c);if(v)return cdq23Norm_(v)==='balance de plancher';}return false;});
 if(!floors.length)return {skip:true,reason:'Le type indiqué dans le Sheet n’est pas Balance de plancher.'};
 if(floors.length!==1)throw Error('Plusieurs formulaires de balance de plancher dans le même onglet.');
 // These column anchors distinguish the inspected legacy form from other tables.
 var weight=find(function(s){return s==='poids';}).filter(function(p){return p.c===5&&cdq23Norm_(at(p.r,43))==='avant correction'&&cdq23Norm_(at(p.r,81))==='apres correction';});
 if(weight.length!==1)throw Error('Colonnes Poids / Avant correction / Après correction non reconnues.');
 var base=floors[0].r-22, r=weight[0].r,values={};
 function put(k,v){v=cdq23Text_(v);if(v!=='')values[k]=v;}
 function number(v,label){v=cdq23Text_(v).replace(/\u00a0|\u202f|\s/g,'').replace(',','.');if(!v)return '';if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(v)||!isFinite(Number(v)))throw Error('Valeur numérique non reconnue : '+label);return String(Number(v));}
 function numeric(k,v){put(k,number(v,k));}
 function labelled(test,key){var a=find(test);if(a.length===1){var p=a[0];for(var c=p.c+1;c<Math.min(p.c+30,100);c++){var v=at(p.r,c);if(v){put(key,v);break;}}}}
 labelled(function(s){return /^client\s*:$/.test(s);},'client_nom');labelled(function(s){return /^ville\s*:$/.test(s);},'client_ville');
 labelled(function(s){return /^adresse\s*:$/.test(s);},'client_adresse');
 ['indicateur','base_balance','imprimante'].forEach(function(prefix,i){var col=10+30*i;['fabricant','modele','numero_serie'].forEach(function(part,j){put(prefix+'_'+part,at(base+25+j,col));});});
 put('identification_balance',at(base+28,10));
 var cap=at(base+28,46).match(/^\s*([\d\s.,]+)\s*(mg|kg|g|lb|lbs|oz|t)?\s*[x×]\s*([\d\s.,]+)\s*(mg|kg|g|lb|lbs|oz|t)?\s*$/i);
 if(!cap)throw Error('Capacité et échelon non reconnus. Vérification manuelle nécessaire.');
 numeric('capacite_maximale',cap[1]);numeric('echelon',cap[3]);if(Number(values.echelon)<=0)throw Error('L’échelon doit être positif.');
 var units=[[14,'lb'],[18,'kg'],[23,'g'],[27,'oz'],[31,'autre']].filter(function(p){return /^(true|vrai)$/i.test(at(base+34,p[0]));}).map(function(p){return p[1];});
 if(units.length!==1||units[0]==='autre')throw Error('Unité de mesure manquante ou ambiguë.');values.unite_mesure=units[0];
 if(cap[2]&&cap[2].toLowerCase().replace('lbs','lb')!==units[0]||cap[4]&&cap[4].toLowerCase().replace('lbs','lb')!==units[0])throw Error('L’unité cochée diffère de la capacité ou de l’échelon.');
 labelled(function(s){return s.indexOf('etendue de la balance utilisee')===0;},'etendue_verifiee');
 // Poids → charge utilisée du PDF; Charge utilisée du Sheet → charge de contrainte du PDF.
 if(cdq23Norm_(at(r,24))!=='charge utilisee')throw Error('Colonne Charge utilisée non reconnue.');
 for(var n=1;n<=6;n++){numeric('charge_point_'+n+'_charge_utilisee',at(r+n,5));numeric('charge_point_'+n+'_charge_contrainte',at(r+n,24));numeric('charge_point_'+n+'_avant_correction',at(r+n,43));numeric('charge_point_'+n+'_apres_correction',at(r+n,81));}
 if(!Object.keys(values).some(function(k){return /^charge_point_\d_charge_utilisee$/.test(k);}))throw Error('Aucun poids de test renseigné.');
 if(!/charge/i.test(at(base+36,81)))throw Error('Charge d’excentricité non reconnue.');numeric('charge_excentricite',at(base+36,88));
 // The Sheet diagram numbers: 1 front-left, 2 rear-left, 3 rear-right, 4 front-right.
 ['avant_gauche','arriere_gauche','arriere_droit','avant_droit'].forEach(function(point,i){var col=56+11*i;if(at(base+42,col)!==String(i+1))throw Error('Points d’excentricité non reconnus.');numeric('excentricite_avant_'+point,at(base+43,col));numeric('excentricite_apres_'+point,at(base+44,col));});
 labelled(function(s){return s.indexOf('poids etalons utilises pour letalonnage')===0;},'etalon_utilise');
 var dates=find(function(s){return /^date detalonnage\s*:$/.test(s);});if(dates.length!==1||dates[0].c!==46)throw Error('Date d’étalonnage non reconnue.');var d=dates[0].r;
 put('client_technicien',at(d,9));
 function date(prefix,cols){var parts=cols.map(function(c){return number(at(d,c),prefix);});if(parts[2]&&Number(parts[2])<100)parts[2]=String(2000+Number(parts[2]));if(parts[0]&&(Number(parts[0])<1||Number(parts[0])>31)||parts[1]&&(Number(parts[1])<1||Number(parts[1])>12)||parts[2]&&(Number(parts[2])<2000||Number(parts[2])>2199))throw Error('Date invalide : '+prefix);parts.forEach(function(v,i){put(prefix+'_'+(i+1),v);});return parts;}
 var calibrated=date('date_etalonnage',[57,60,63]),due=date('prochain_etalonnage',[84,87,90]);
 if(calibrated[1]&&calibrated[2]&&due[1]&&due[2]){var months=(Number(due[2])-Number(calibrated[2]))*12+Number(due[1])-Number(calibrated[1]);if([1,2,3,4,5,6,12,24].indexOf(months)>=0)values.frequence_etalonnage=months+' mois';}
 var yes=/^(true|vrai)$/i.test(at(base+62,47)),no=/^(true|vrai)$/i.test(at(base+62,50));if(yes!==no)values.legal_pour_commerce=yes?'Oui':'Non';
 return {skip:false,values:values,warnings:(!due[0]&&due[1]?'Jour de la prochaine date absent : conservé vide.':'')};
}
