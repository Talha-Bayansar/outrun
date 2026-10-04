import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import type { Snapshot } from '../../../packages/api-client/src/index.ts';
export default function GameMap({ snapshot, now }: { snapshot: Snapshot; now: number }) {
  const { center, radiusMeters } = snapshot.area;
  const markers = [snapshot.locations.own, ...(snapshot.locations.reveal && snapshot.locations.reveal.expiresAt > now ? snapshot.locations.reveal.markers : [])].filter(Boolean);
  const scale = 130 / radiusMeters;
  return <View style={styles.map}><Svg width="100%" height={300} viewBox="0 0 320 320">
    <Circle cx={160} cy={160} r={130} fill="#e6eddf" stroke="#52705a" strokeWidth={3} strokeDasharray="8 6" />
    {markers.map(marker => { if (!marker) return null;
      const x = 160 + (marker.longitude - center.longitude) * 111320 * Math.cos(center.latitude * Math.PI / 180) * scale;
      const y = 160 - (marker.latitude - center.latitude) * 111320 * scale;
      return <Svg key={marker.playerId}><Circle cx={x} cy={y} r={8} fill={marker.playerId === snapshot.locations.own?.playerId ? '#245840' : '#ba4933'} />
        <SvgText x={x} y={y - 14} textAnchor="middle" fontSize={12}>{snapshot.session.players.find(p => p.id === marker.playerId)?.name}</SvgText></Svg>;
    })}
  </Svg><Text style={styles.caption}>Boundary overview · {radiusMeters} m radius · North ↑</Text></View>;
}
const styles = StyleSheet.create({ map: { backgroundColor: '#edf2e8', borderRadius: 20, overflow: 'hidden' }, caption: { textAlign: 'center', paddingBottom: 15, color: '#617267' } });
