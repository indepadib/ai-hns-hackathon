(function(root){
'use strict';
// Starting reference only, intentionally mirrors the public benchmark baseline.
const specs={
 availability:{name:'Ruptures',fields:['previous_stockout'],rule:'return "yes" if int(row["previous_stockout"]) else "no"',tip:'Comparez la persistance avec une règle de couverture de stock, puis testez sur des dates ultérieures.'},
 fresh:{name:'DLC et démarque',fields:['expiry_date','quantity','daily_sales'],rule:'return "review"',tip:'Remplacez le contrôle systématique par une règle explicable sur la DLC et les ventes. Conservez un contrôle humain.'},
 loyalty:{name:'Fidélité',fields:['visits_last_14d'],rule:'return "yes" if int(row["visits_last_14d"]) > 0 else "no"',tip:'Ajoutez des variables calculées uniquement avant la coupure. Le consentement reste une condition séparée.'},
 inspection:{name:'Contrôle rayon',fields:['empty_facings'],rule:'return "review"',tip:'Utilisez les observations structurées et vérifiez les valeurs manquantes. Ce jeu ne mesure pas la vision par ordinateur.'}
};
function build(id){
 if(!Object.hasOwn(specs,id))throw Error('Challenge inconnu.');
 const s=specs[id],input='hns-'+id+'-evaluation-inputs.csv',output='hns-'+id+'-predictions.csv';
 const script=[
 '# H&S AI Talent Challenge — référence de départ (non IA)',
 '# Données synthétiques. Ne pas utiliser pour des décisions réelles.',
 'import csv, argparse',
 'from pathlib import Path',
 '',
 'def predict(row):',
 '    # TODO : remplacez cette référence par votre solution, sans utiliser les labels.',
 '    '+s.rule,
 '',
 'def main():',
 '    parser = argparse.ArgumentParser(description="H&S benchmark starter")',
 '    parser.add_argument("--input", default="'+input+'")',
 '    parser.add_argument("--output", default="'+output+'")',
 '    args = parser.parse_args()',
 '    if Path(args.input).resolve() == Path(args.output).resolve():',
 '        raise ValueError("Les fichiers entrée et sortie doivent être différents")',
 '    with open(args.input, encoding="utf-8-sig", newline="") as source:',
 '        reader = csv.DictReader(source)',
 '        required = '+JSON.stringify(['sample_id',...s.fields]),
 '        if not set(required).issubset(reader.fieldnames or []):',
 '            raise ValueError("Colonnes requises absentes")',
 '        predictions, seen = [], set()',
 '        for row in reader:',
 '            key = row["sample_id"]',
 '            if not key or key in seen:',
 '                raise ValueError("sample_id vide ou dupliqué")',
 '            seen.add(key)',
 '            predictions.append({"sample_id": key, "prediction": predict(row)})',
 '    if not predictions:',
 '        raise ValueError("Aucune observation")',
 '    with open(args.output, "w", encoding="utf-8", newline="") as target:',
 '        writer = csv.DictWriter(target, fieldnames=["sample_id", "prediction"])',
 '        writer.writeheader()',
 '        writer.writerows(predictions)',
 '    print(f"{len(predictions)} predictions ecrites dans {args.output}")',
 '',
 'if __name__ == "__main__":',
 '    main()',''
 ].join('\n');
 const readme=['# Kit prototype — '+s.name,'','1. Téléchargez les entrées CSV et starter.py dans le même dossier.','2. Exécutez : python starter.py','3. Importez '+output+' dans le banc d’essai H&S.','4. Modifiez predict(row), gardez les mêmes sample_id et comparez vos résultats.','','Référence déterministe, pas un modèle IA ni un résultat officiel. Aucun accès réseau ni paquet externe.','','Piste : '+s.tip,'','Documentez votre méthode, les erreurs et les limites. Ne consultez pas les cibles d’évaluation pour optimiser vos prédictions.'].join('\n');
 return {script,readme,input,output,tip:s.tip,name:s.name};
}
root.HNSStarterKit=Object.freeze({build});
})(globalThis);
