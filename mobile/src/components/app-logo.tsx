import Svg, { Path } from 'react-native-svg';

// Exact geometry extracted from the owner-licensed reference vector
// (shutterstock_1758547613.eps, parsed 2026-07-08): the molecule /
// network mark as one united silhouette path, normalised to a
// top-left-origin viewBox with the PostScript y-axis flipped.
const LOGO_W = 1542.39;
const LOGO_H = 1947.29;
const LOGO_PATH =
  'M1055.8 1276.04 L1115.23 1444.28 C1125.09 1443.1 1135.12 1442.48 1145.29 1442.48 C1284.66 1442.48 1397.69 1555.53 1397.69 1694.91 C1397.69 1834.28 1284.66 1947.29 1145.29 1947.29 C1005.91 1947.29 892.88 1834.28 892.88 1694.91 C892.88 1604.76 940.17 1525.66 1011.28 1481.0 L954.21 1319.45 C938.82 1322.33 922.98 1323.86 906.77 1323.86 C807.04 1323.86 720.6 1266.84 678.29 1183.66 L412.54 1247.63 C408.82 1358.31 317.91 1446.9 206.34 1446.9 C92.4 1446.9 0.0 1354.52 0.0 1240.56 C0.0 1126.64 92.4 1034.22 206.34 1034.22 C283.93 1034.22 351.53 1077.08 386.77 1140.44 L650.75 1076.88 C650.65 1073.83 650.56 1070.75 650.56 1067.68 C650.56 939.14 745.27 832.7 868.68 814.3 L868.68 405.22 C781.5 381.11 717.47 301.19 717.47 206.34 C717.47 92.4 809.85 0.0 923.81 0.0 C1037.74 0.0 1130.15 92.4 1130.15 206.34 C1130.15 301.19 1066.11 381.11 978.93 405.22 L978.93 821.81 C1079.97 851.44 1155.15 941.68 1162.37 1050.47 L1252.67 1065.04 C1279.49 1018.6 1329.68 987.35 1387.15 987.35 C1472.89 987.35 1542.39 1056.87 1542.39 1142.56 C1542.39 1228.3 1472.89 1297.8 1387.15 1297.8 C1312.16 1297.8 1249.59 1244.6 1235.09 1173.88 L1145.97 1159.52 C1127.86 1206.64 1096.23 1247.08 1055.8 1276.04 Z';

// Brand-red placeholder matching the asset (register #23 still open).
const LOGO_RED = '#FF0000';

/** App logo mark — `height` scales the whole artwork (width follows
 *  the true aspect). */
export function AppLogo({ height = 22, color = LOGO_RED }: { height?: number; color?: string }) {
  const width = (height / LOGO_H) * LOGO_W;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${LOGO_W} ${LOGO_H}`}>
      <Path d={LOGO_PATH} fill={color} />
    </Svg>
  );
}
