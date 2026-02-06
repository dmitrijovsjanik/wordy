import { generateSpellingOptions, generateTypoVariantsWithMeta } from './src/services/game/generators/typo-generators/index.js';

console.log('=== Test Double Letter Generator ===\n');

const testWords = ['cover', 'team', 'hello', 'necessary', 'balloon', 'success'];

for (const word of testWords) {
  console.log(`\n${word.toUpperCase()}:`);

  // Получаем варианты с метаданными
  const variants = generateTypoVariantsWithMeta(word, { totalVariants: 5 });

  // Показываем только double-letter варианты
  const doubleVariants = variants.filter(v =>
    v.type === 'double-add' || v.type === 'double-simplify'
  );

  if (doubleVariants.length > 0) {
    console.log('  Double-letter variants:');
    doubleVariants.forEach(v => {
      console.log(`    ${v.variant} (${v.type}, confidence: ${v.confidence})`);
    });
  } else {
    console.log('  No double-letter variants');
  }

  // Полный набор для квиза
  const options = generateSpellingOptions(word, 6);
  console.log(`  Quiz options: [${options.join(', ')}]`);
}

console.log('\n=== Check for unrealistic doubles (should be NONE) ===\n');

const checkWords = ['cover', 'team', 'top', 'pair', 'cat'];
for (const word of checkWords) {
  const variants = generateTypoVariantsWithMeta(word, { totalVariants: 10 });
  const unrealistic = variants.filter(v => {
    // Проверяем двойные буквы в начале слова
    return /^([a-z])\1/.test(v.variant);
  });

  if (unrealistic.length > 0) {
    console.log(`❌ ${word}: FOUND UNREALISTIC → ${unrealistic.map(v => v.variant).join(', ')}`);
  } else {
    console.log(`✅ ${word}: OK (no doubles at start)`);
  }
}
