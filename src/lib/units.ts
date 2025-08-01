// Create this file: src/lib/units.ts

export const convertUnits = {
  // Swell height: feet to metres
  feetToMetres: (feet: number): number => {
    return Math.round(feet * 0.3048 * 10) / 10; // Round to 1 decimal
  },
  
  // Wind speed: knots to km/h
  knotsToKmh: (knots: number): number => {
    return Math.round(knots * 1.852 * 10) / 10; // Round to 1 decimal
  },
  
  // Format swell height display
  formatSwellHeight: (feet: number | null): string => {
    if (!feet) return 'N/A';
    const metres = convertUnits.feetToMetres(feet);
    return `${metres}m`;
  },
  
  // Format wind speed display  
  formatWindSpeed: (knots: number | null): string => {
    if (!knots) return 'N/A';
    const kmh = convertUnits.knotsToKmh(knots);
    return `${kmh}km/h`;
  },
  
  // Tolerance calculations for predictions (in metric)
  getSwellTolerance: (metres1: number, metres2: number): number => {
    return Math.abs(metres1 - metres2);
  },
  
  getWindTolerance: (kmh1: number, kmh2: number): number => {
    return Math.abs(kmh1 - kmh2);
  }
};

export default convertUnits;