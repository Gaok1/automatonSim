export const EXAMPLES = [
  {
    label: 'AFD: termina com a',
    load: () => import('../../examples/afd_ends_with_a.json', { assert: { type: 'json' } }).then(m => m.default)
  },
  {
    label: 'AFD: múltiplos de 3 (binário)',
    load: () => import('../../examples/afd_binary_divisible_by_3.json', { assert: { type: 'json' } }).then(m => m.default)
  },
  {
    label: 'AFD: alterna A/B (simples)',
    load: () => import('../../examples/afd_parity_AB.json', { assert: { type: 'json' } }).then(m => m.default)
  },
  {
    label: 'AFNλ: a ou ab',
    load: () => import('../../examples/afn_lambda_a_or_ab.json', { assert: { type: 'json' } }).then(m => m.default)
  }
];
