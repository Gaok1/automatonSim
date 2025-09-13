import afdEndsWithA from '../../examples/afd_ends_with_a.json' assert { type: 'json' };
import afdBinaryDivisibleBy3 from '../../examples/afd_binary_divisible_by_3.json' assert { type: 'json' };
import afdParityAB from '../../examples/afd_parity_AB.json' assert { type: 'json' };
import afnLambdaAOrAB from '../../examples/afn_lambda_a_or_ab.json' assert { type: 'json' };

export const EXAMPLES = [
  { label: 'AFD: termina com a', data: afdEndsWithA },
  { label: 'AFD: múltiplos de 3 (binário)', data: afdBinaryDivisibleBy3 },
  { label: 'AFD: alterna A/B (simples)', data: afdParityAB },
  { label: 'AFNλ: a ou ab', data: afnLambdaAOrAB }
];
