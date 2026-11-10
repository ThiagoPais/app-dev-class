export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Brasília, used when an RA has no entry below. */
export const DF_CENTER: Coordinates = { latitude: -15.7939, longitude: -47.8828 };

/** Approximate centre of each RA (geocoded from OpenStreetMap), keyed by its forum name. */
export const REGION_COORDINATES: Record<string, Coordinates> = {
  'Plano Piloto': { latitude: -15.7939, longitude: -47.8828 },
  Gama: { latitude: -16.0171, longitude: -48.0653 },
  Taguatinga: { latitude: -15.8335, longitude: -48.0566 },
  Brazlândia: { latitude: -15.6809, longitude: -48.1943 },
  Sobradinho: { latitude: -15.6501, longitude: -47.7848 },
  Planaltina: { latitude: -15.6182, longitude: -47.6556 },
  Paranoá: { latitude: -15.7754, longitude: -47.7798 },
  'Núcleo Bandeirante': { latitude: -15.8712, longitude: -47.968 },
  Ceilândia: { latitude: -15.8173, longitude: -48.1046 },
  Guará: { latitude: -15.8236, longitude: -47.9768 },
  Cruzeiro: { latitude: -15.7908, longitude: -47.9374 },
  Samambaia: { latitude: -15.877, longitude: -48.0881 },
  'Santa Maria': { latitude: -16.0171, longitude: -48.0131 },
  'São Sebastião': { latitude: -15.9034, longitude: -47.7718 },
  'Recanto das Emas': { latitude: -15.9025, longitude: -48.0608 },
  'Lago Sul': { latitude: -15.8392, longitude: -47.8755 },
  'Riacho Fundo': { latitude: -15.8833, longitude: -48.0175 },
  'Lago Norte': { latitude: -15.7342, longitude: -47.8642 },
  Candangolândia: { latitude: -15.8537, longitude: -47.9494 },
  'Águas Claras': { latitude: -15.842, longitude: -48.0281 },
  'Riacho Fundo II': { latitude: -15.9071, longitude: -48.0488 },
  'Sudoeste/Octogonal': { latitude: -15.8002, longitude: -47.9244 },
  Varjão: { latitude: -15.7108, longitude: -47.8763 },
  'Park Way': { latitude: -15.9027, longitude: -47.9633 },
  'SCIA/Estrutural': { latitude: -15.7821, longitude: -47.9969 },
  'Sobradinho II': { latitude: -15.6437, longitude: -47.826 },
  'Jardim Botânico': { latitude: -15.8639, longitude: -47.7885 },
  Itapoã: { latitude: -15.7485, longitude: -47.7697 },
  SIA: { latitude: -15.8062, longitude: -47.9592 },
  'Vicente Pires': { latitude: -15.8136, longitude: -48.0156 },
  Fercal: { latitude: -15.6002, longitude: -47.8716 },
  'Sol Nascente/Pôr do Sol': { latitude: -15.8276, longitude: -48.1371 },
  Arniqueira: { latitude: -15.859, longitude: -48.0122 },
  Arapoanga: { latitude: -15.6422, longitude: -47.6515 },
  'Água Quente': { latitude: -15.9419, longitude: -48.2332 },
};
