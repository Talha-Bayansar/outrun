import MapView, { Circle, Marker } from 'react-native-maps';
import type { Snapshot } from '../../../packages/api-client/src/index.ts';
export default function GameMap({ snapshot, now }: { snapshot: Snapshot; now: number }) {
  const { center, radiusMeters } = snapshot.area;
  const reveal = snapshot.locations.reveal;
  return <MapView style={{ height: 300, borderRadius: 20 }} initialRegion={{ ...center,
    latitudeDelta: radiusMeters / 35000, longitudeDelta: radiusMeters / 35000 }}>
    <Circle center={center} radius={radiusMeters} strokeColor="#347181" fillColor="#34718122" />
    {snapshot.locations.own && <Marker coordinate={snapshot.locations.own} title="You" pinColor="#215ad1" />}
    {reveal && reveal.expiresAt > now && reveal.markers.map(marker => <Marker key={marker.playerId} coordinate={marker}
      title={snapshot.session.players.find(p => p.id === marker.playerId)?.name} pinColor="#c54935" />)}
  </MapView>;
}
