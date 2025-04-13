export const convertTicksToCartesianDigits = (
  ticks: number[],
  pipSize: number
) => {
  if (ticks.length < 1) return [];

  const firstTick = ticks[0];
  const digitsArray = [+firstTick.toFixed(pipSize).slice(-1)];

  for (let i = 1; i < ticks.length; i++) {
    // Obtém os ticks atual e anteriores
    const currentTick = ticks[i];
    const previousTick = ticks[i - 1];
    const secondPreviousTick = ticks[i - 2];

    // Calcula os dígitos
    const currentDigit = +currentTick.toFixed(pipSize).slice(-1);
    const previousDigit = +previousTick.toFixed(pipSize).slice(-1);

    // Determina o sinal do dígito anterior com base na direção do preço
    const isDescendingBefore = (secondPreviousTick ?? 0) > previousTick;
    const formattedPreviousDigit = isDescendingBefore
      ? -previousDigit
      : previousDigit;

    // Verifica a direção atual do preço
    const isAscending = currentTick > previousTick;
    const isDescending = currentTick < previousTick;

    // Calcula o dígito cartesiano
    let cartesianDigit = 0;

    if (isAscending) {
      if (currentDigit === 0) {
        cartesianDigit = formattedPreviousDigit > 5 ? 10 : 0;
      } else {
        cartesianDigit = currentDigit;
      }
    } else if (isDescending) {
      if (currentDigit === 0) {
        cartesianDigit = formattedPreviousDigit < -5 ? -10 : 0;
      } else {
        cartesianDigit = -currentDigit;
      }
    }

    digitsArray.push(cartesianDigit);
  }

  return digitsArray;
};
