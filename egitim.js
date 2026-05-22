const Kernel = require('./kernel');
const Dream = require('./dream');

// Eğitim: temiz başlat, mevcut hafızayı karıştırma
const k = new Kernel({ noLoad: true });
const d = new Dream(k);

const veriler = [
  // MANTIK - Logik
  'her A Bdir',
  'bazı A Bdir',
  'hiçbir A B değildir',
  'mantık doğru düşünme yöntemidir',
  'önerme doğru veya yanlış olabilir',
  'çıkarım önermelerden sonuç bulmaktır',
  'tümdengelim genelden özele gider',
  'tümevarım özelden genele gider',
  'sebep sonuç ilişkisine neden denir',
  'A ise B ve A doğruysa B doğrudur',
  'A ise B ve B yanlışsa A yanlıştır',
  'çelişki aynı anda hem doğru hem yanlış olamaz',

  // FELSEFE - Philosophie
  'felsefe bilgelik sevgisidir',
  'bilgi güçtür',
  'merak öğrenmenin temelidir',
  'şüphe düşüncenin başlangıcıdır',
  'soru cevaptan değerlidir',
  'her cevap yeni soru doğurur',
  'düşünce soyut kavramlar üretir',
  'kavram düşüncenin yapı taşıdır',
  'bağlantı kavramlar arası köprüdür',
  'anlamak bağlantıları görmektir',
  'gerçek kanıtlanabilir olgudur',
  'hipotez test edilebilir varsayımdır',
  'teori kanıtlanmış hipotezler bütünüdür',
  'paradoks kendisiyle çelişen ifadedir',
  'bilinmezlik öğrenme fırsatıdır',

  // ÖĞRENME - Lernen
  'öğrenmek yeni bağlantılar kurmaktır',
  'öğrenme tekrarla güçlenir',
  'gözlem veri toplamaktır',
  'veri ham bilgidir',
  'bilgi işlenmiş veridir',
  'deneyim öğrenmenin en iyi yoludur',
  'hata öğrenme fırsatıdır',
  'benzerlik yeni kavramları anlamayı kolaylaştırır',
  'farklılık kavramları ayırt etmeyi sağlar',
  'kategorize etmek bilgiyi düzenlemektir',
  'karşılaştırma analizin temelidir',
  'sınıflandırma bilgiyi hiyerarşik düzenler',

  // BİLİM - Wissenschaft
  'bilim gözlemle başlar',
  'deney hipotezi test eder',
  'veri analizi pattern bulur',
  'pattern düzenli tekrardır',
  'model gerçeğin basitleştirilmiş halidir',
  'simülasyon modelin çalıştırılmasıdır',
  'doğrulama teorinin test edilmesidir',
  'yanlışlama bilimsel ilerlemenin motorudur',
  'sebep sonuca neden olur',
  'sonuç sebebin etkisidir',

  // MATEMATİK - Matematik
  'küme nesneler topluluğudur',
  'Venn şeması kümeleri görselleştirir',
  'kesişim ortak özellikleri bulur',
  'birleşim tüm özellikleri toplar',
  'fonksiyon girdiyi çıktıya dönüştürür',
  'vektör yön ve büyüklük içerir',
  'matris sayıların dikdörtgen dizisidir',
  'dönüşüm bir şeyi başka şeye çevirir',
  'entropi düzensizlik ölçüsüdür',
  'olasılık belirsizlik ölçüsüdür',
  'eğilim olası en kısa yoldur',

  // SİSTEM - Kendi Kendine
  'AXIOM bilgi grafiği motorudur',
  'düğüm kavramı temsil eder',
  'kenar ilişkiyi temsil eder',
  'weight ilişkinin gücünü gösterir',
  'rüya hipotez üretmektir',
  'doğruluk hipotezi test eder',
  'amplifikasyon doğru cevabı güçlendirir',
  'simülasyon hipotezleri karşılaştırır',
  'gömme vektör kavramı sayılarla temsil eder',
  'benzerlik vektörler arası açıdır',
  'unutma eğrisi zamanla zayıflamayı modeller',
  'budama gereksiz bağlantıları temizler',
  'plugin sistemi genişletilebilirlik sağlar',
  'Rust hızlandırıcı büyük grafikler için',
  'Bilmiyorum bilinmeyeni kabul etmektir',
  'bilinmeyeni kabul etmek öğrenmenin başlangıcıdır',
];

console.log(`🧠 AXIOM Eğitim Başladı: ${veriler.length} bilgi`);
for (const v of veriler) {
  k.learn(v);
}

console.log(`📊 İstatistik: ${Object.keys(k.graph._nodes).length} düğüm, ${k.graph._edges.length} kenar`);
console.log(`🔍 Entropi: ${k.entropy().toFixed(3)}`);

const gaps = k.detectGaps();
if (gaps.length > 0) console.log(`⚠️  Bağlantısız: ${gaps.join(', ')}`);

const cons = k.detectContradictions();
if (cons.length > 0) {
  console.log(`🔄 Çelişkiler:`);
  for (const c of cons) console.log(`   ${c.node}: ${c.targets.join(', ')}`);
}

console.log('\n💭 Rüya (Hipotezler):');
const h = d.dream();
if (h.length === 0) console.log('   Hipotez yok.');
else for (const x of h.slice(0, 10)) {
  console.log(`   ${x.from} → ${x.to} (${x.type}, güven: ${x.confidence.toFixed(3)})`);
}

console.log('\n🔗 Örnek Çıkarımlar:');
const sorular = ['mantık nedir', 'felsefe nedir', 'öğrenmek nedir', 'bilim nedir', 'hipotez nedir', 'AXIOM nedir'];
for (const s of sorular) {
  console.log(`   sor: "${s}" → ${k.ask(s)}`);
}

console.log('\n🧪 Test: bilinmeyen kavram:');
console.log(`   sor: "uçan fil nedir" → ${k.ask('uçan fil nedir')}`);

const emb = d.embedding({ dimensions: 64, walksPerNode: 8, walkLength: 15 });
if (emb) console.log(`\n📐 Gömme: ${emb.dimensions} boyut, ${emb.nodes} düğüm`);

const similars = d.findSimilar('öğrenmek', 5);
if (similars.length > 0) {
  console.log(`\n🔎 "öğrenmek" e en yakın kavramlar:`);
  for (const s of similars) console.log(`   ${s.id}: ${s.score.toFixed(3)}`);
}

k.graph.save();
console.log('\n💾 Hafıza kaydedildi.');
console.log('✅ Eğitim tamam. node cli.js ile konuşmaya devam et.');
