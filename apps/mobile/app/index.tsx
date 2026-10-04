import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet, Platform, Share, Image, Alert, Linking as SystemLinking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import QRCode from 'react-native-qrcode-svg';
import { ApiClient, ApiError } from '../../../packages/api-client/src/index.ts';
import type { Membership, Snapshot } from '../../../packages/api-client/src/index.ts';
import { distanceMeters } from '../../../packages/game-engine/src/location.ts';
import GameMap from '../src/GameMap';
import { read, write } from '../src/storage';
import { sample, startBackground, stopBackground } from '../src/tracking';

const defaultApi = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';
const colors = { ink: '#183e32', muted: '#617267', paper: '#f0f3ed', white: '#ffffff', blue: '#245840', orange: '#ba4933', lime: '#d9f275', line: '#d5dfd3' };
const time = (ms: number) => `${Math.floor(Math.max(0, ms) / 60000)}:${String(Math.floor(Math.max(0, ms) / 1000) % 60).padStart(2, '0')}`;
function Button({ title, onPress, disabled = false, quiet = false }: { title: string; onPress: () => void; disabled?: boolean; quiet?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, quiet && s.quiet, disabled && s.disabled, pressed && { opacity: .75 }]}>
    <Text style={[s.buttonText, quiet && { color: colors.ink }, disabled && { color: colors.muted }]}>{title}</Text></Pressable>;
}
function Field({ label, value, onChange, numeric = false, placeholder, uppercase = false }: { label: string; value: string; onChange: (v: string) => void; numeric?: boolean; placeholder?: string; uppercase?: boolean }) {
  return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} style={[s.input, uppercase && s.codeInput]} placeholder={placeholder} placeholderTextColor="#829085" value={value} onChangeText={onChange} keyboardType={numeric ? 'numeric' : 'default'} autoCorrect={false} autoCapitalize={uppercase ? "characters" : "none"} /></View>;
}
export default function Home() {
  const [baseUrl, setBaseUrl] = useState(defaultApi), [name, setName] = useState(''), [code, setCode] = useState('');
  const [member, setMember] = useState<Membership>(), [snapshot, setSnapshot] = useState<Snapshot>();
  const [connected, setConnected] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [serverSettings, setServerSettings] = useState(false);
  const [creating, setCreating] = useState(false), [now, setNow] = useState(Date.now()), [gps, setGps] = useState('Location not checked');
  const [background, setBackground] = useState(false), [targetId, setTargetId] = useState(''), [photo, setPhoto] = useState<string>();
  const [duration, setDuration] = useState('45'), [headStart, setHeadStart] = useState('3'), [interval, setIntervalMinutes] = useState('3');
  const [windowSeconds, setWindowSeconds] = useState('10'), [radius, setRadius] = useState('1000'), [captureRadius, setCaptureRadius] = useState('25');
  const [latitude, setLatitude] = useState(''), [longitude, setLongitude] = useState('');
  const offset = useRef(0), current = useRef<Snapshot | undefined>(undefined), client = new ApiClient(baseUrl, member);
  const url = Linking.useURL();
  useEffect(() => { if (url) { const parsed = Linking.parse(url); const invite = parsed.queryParams?.code; if (typeof invite === 'string') setCode(invite); } }, [url]);
  useEffect(() => { void read('membership').then(value => { if (value) { const stored = JSON.parse(value); setBaseUrl(stored.baseUrl); setMember(stored.membership); } }).catch(() => setError('Saved game could not be recovered.')); }, []);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now() + offset.current), 1000); return () => clearInterval(timer); }, []);
  const apply = (value: Snapshot) => {
    if (current.current && value.session.id === current.current.session.id && value.version < current.current.version) return;
    const previous = current.current; current.current = value; offset.current = value.serverTime - Date.now(); setNow(value.serverTime); setSnapshot(value);
    if (previous && previous.session.phase !== value.session.phase && Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };
  useEffect(() => {
    if (!member) return;
    let disposed = false;
    const api = new ApiClient(baseUrl, member);
    const unsubscribe = api.subscribe(apply, setConnected);
    const refresh = () => api.snapshot().then(value => { if (disposed) return; setConnected(true); apply(value); }).catch(e => { if (disposed) return; setConnected(false); if (e instanceof ApiError && [401, 410].includes(e.status)) setError('Game access expired. Leave this screen to join again.'); });
    void refresh(); const poll = setInterval(() => void refresh(), 5000);
    return () => { disposed = true; unsubscribe(); clearInterval(poll); };
  }, [member?.sessionId, baseUrl]);
  const player = snapshot?.session.players.find(p => p.id === member?.playerId), phase = snapshot?.session.phase;
  const activeTracking = !!member && !!snapshot && !player?.left && !player?.eliminated && ['countdown', 'head_start', 'active'].includes(phase ?? '') && now < (snapshot.session.deadlines?.endsAt ?? 0);
  useEffect(() => {
    let subscription: Location.LocationSubscription | undefined, disposed = false;
    if (activeTracking) {
      void Location.getForegroundPermissionsAsync().then(permission => {
        if (!permission.granted) { setGps('Location permission needed'); return; }
        return Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 10_000, distanceInterval: 5 }, location => {
          if (disposed) return;
          setGps(`GPS ±${Math.round(location.coords.accuracy ?? 999)} m`);
          void new ApiClient(baseUrl, member).location(sample(location)).then(r => { if (!r.accepted && r.reason !== 'out_of_order') setGps(r.reason?.replaceAll('_', ' ') ?? 'GPS rejected'); }).catch(() => setGps('GPS upload offline'));
        });
      }).then(value => { if (disposed) value?.remove(); else subscription = value; }).catch(() => setGps('Unable to start GPS. Open settings.'));
    } else if (Platform.OS !== 'web') void stopBackground().catch(() => {});
    return () => { disposed = true; subscription?.remove(); };
  }, [activeTracking, member?.sessionId, baseUrl]);
  useEffect(() => { if (!activeTracking) setBackground(false); }, [activeTracking]);
  useEffect(() => {
    if (phase !== 'lobby' || !player?.ready || !member) return;
    const timer = setInterval(() => { void Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).then(position =>
      new ApiClient(baseUrl, member).location(sample(position))).then(result => { if (!result.accepted) setGps('Refresh GPS before starting'); }).catch(() => setGps('GPS check unavailable')); }, 20_000);
    return () => clearInterval(timer);
  }, [phase, player?.ready, member?.sessionId, baseUrl]);
  async function act(work: () => Promise<void>) { setBusy(true); setError(''); try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to connect. Try again.'); } finally { setBusy(false); } }
  async function remember(membership: Membership) { await write('membership', JSON.stringify({ baseUrl, membership })); current.current = undefined; setSnapshot(undefined); setMember(membership); }
  async function command(type: string, payload: Record<string, unknown> = {}) { await client.command({ id: Crypto.randomUUID(), type, ...payload }); apply(await client.snapshot()); }
  async function checkGps(upload = true) {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) throw new Error('Allow location in settings to play.');
    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    setGps(`GPS ±${Math.round(location.coords.accuracy ?? 999)} m`);
    if (upload && member) { const result = await client.location(sample(location)); if (!result.accepted) throw new Error(result.reason?.replaceAll('_', ' ') ?? 'GPS unavailable'); }
    return location;
  }
  async function leave() {
    // Local stop works even without a connection; server forfeit is attempted when reachable.
    if (Platform.OS !== 'web') await stopBackground();
    current.current = undefined; setSnapshot(undefined); setMember(undefined); setConnected(false);
    await write('membership', null);
    try { await client.command({ id: Crypto.randomUUID(), type: 'leave' }); } catch { /* Local departure always stops device collection. */ }
  }
  async function takePhoto() {
    if (!connected) throw new Error('Reconnect before capturing.');
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Allow camera in settings to capture.');
    const result = await ImagePicker.launchCameraAsync({ quality: .7, exif: false });
    if (!result.canceled) {
      const asset = result.assets[0];
      const width = Math.round(Math.min(1200, 1200 * asset.width / asset.height, asset.width));
      const image = await ImageManipulator.manipulateAsync(asset.uri, [{ resize: { width } }], { compress: .7, format: ImageManipulator.SaveFormat.JPEG });
      setPhoto(image.uri);
    }
  }
  const isHost = player?.id === snapshot?.session.hostId;
  const reveal = snapshot?.locations.reveal && snapshot.locations.reveal.expiresAt > now ? snapshot.locations.reveal : undefined;
  const invite = Linking.createURL('/', { queryParams: { code: snapshot?.code ?? '' } });
  const deadlines = snapshot?.session.deadlines;
  const nextReveal = deadlines && snapshot ? deadlines.huntStartsAt + (Math.floor(Math.max(0, now - deadlines.huntStartsAt) / snapshot.session.settings.revealIntervalMs) + 1) * snapshot.session.settings.revealIntervalMs : 0;
  const outside = snapshot?.locations.own && distanceMeters(snapshot.locations.own, snapshot.area.center) - snapshot.locations.own.accuracyMeters > snapshot.area.radiusMeters;
  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
    <View style={s.brand}><Text style={s.wordmark}>OUTRUN↗</Text><View style={s.brandBadge}><Text style={s.brandBadgeText}>GO PLAY OUTSIDE</Text></View></View>
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {!member ? <>
      <View style={s.hero}>
        <Text style={s.eyebrow}>MANHUNT · IN REAL LIFE</Text>
        <Text style={s.heroTitle}>Less scrolling.{'\n'}More running.</Text>
        <Text style={s.heroBody}>Your friends. Your streets. One game of chase.</Text>
        <View style={s.heroStats}><Text style={s.heroStat}>4–20 players</Text><Text style={s.heroStat}>45 min default hunt</Text></View>
        <View style={s.trackMark} accessible={false}><View style={s.trackLine} /><View style={[s.trackLine, { width: '70%' }]} /><View style={[s.trackLine, { width: '40%' }]} /></View>
      </View>
      <View style={s.card}>
        <Text style={s.heading}>First, what should we call you?</Text>
        <Field label="Your name" placeholder="Name your crew will recognize" value={name} onChange={setName} />
      </View>
      <View style={s.card}>
        <View style={s.sectionTop}><Text style={s.heading}>Got an invite?</Text><Text style={s.pill}>JOIN THE CREW</Text></View>
        <Text style={s.body}>Enter the six-character code from your host.</Text>
        <Field label="Invitation code" placeholder="ABC123" uppercase value={code} onChange={v => setCode(v.toUpperCase().replace(/\s/g, '').slice(0, 6))} />
        <Button title={busy ? 'Connecting…' : 'Join game →'} disabled={busy || !name.trim() || code.length !== 6} onPress={() => void act(async () => remember(await client.join(code, name)))} />
      </View>
      <View style={s.createIntro}><Text style={s.heading}>Start something worth chasing.</Text><Text style={s.body}>Choose your playing area, invite friends, and split into hunters and runners.</Text>
      <Button quiet title={creating ? 'Close game setup' : 'Create a Manhunt ↗'} disabled={busy} onPress={() => setCreating(!creating)} /></View>
      {creating && <View style={s.card}>
        <Text style={s.heading}>Set the chase</Text>
        <Field label="Hunting duration (minutes)" value={duration} onChange={setDuration} numeric />
        <Field label="Runner head start (minutes)" value={headStart} onChange={setHeadStart} numeric />
        <Field label="Reveal every (minutes)" value={interval} onChange={setIntervalMinutes} numeric />
        <Field label="Reveal visible (seconds)" value={windowSeconds} onChange={setWindowSeconds} numeric />
        <Field label="Playing radius (meters)" value={radius} onChange={setRadius} numeric />
        <Field label="Capture radius (meters)" value={captureRadius} onChange={setCaptureRadius} numeric />
        <Button quiet title="Use my location as the center" onPress={() => void act(async () => { const p = await checkGps(false); setLatitude(String(p.coords.latitude)); setLongitude(String(p.coords.longitude)); })} />
        <Field label="Center latitude" value={latitude} onChange={setLatitude} numeric /><Field label="Center longitude" value={longitude} onChange={setLongitude} numeric />
        <Text style={s.body}>Choose a safe area and meeting point. The circle can include hazards. Assign hunters in the lobby.</Text>
        <Button title="Create lobby" disabled={busy || !name.trim() || !latitude || !longitude} onPress={() => void act(async () => remember(await client.create({ name,
          settings: { preparationMs: 10000, durationMs: Number(duration) * 60000, headStartMs: Number(headStart) * 60000, revealIntervalMs: Number(interval) * 60000, revealWindowMs: Number(windowSeconds) * 1000 },
          area: { center: { latitude: Number(latitude), longitude: Number(longitude) }, radiusMeters: Number(radius) }, radiusMeters: Number(captureRadius) }))) } />
      </View>}
      <View style={s.safety}><Text style={s.label}>PLAY SAFE. PLAY FAIR.</Text><Text style={s.small}>Stop before checking your phone. Avoid roads and private property. Agree on a meeting point before you start.</Text></View>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: serverSettings }} onPress={() => setServerSettings(!serverSettings)} style={s.settingsToggle}><Text style={s.label}>{serverSettings ? 'Hide connection settings −' : 'Connection settings +'}</Text></Pressable>
      {serverSettings && <View style={s.card}><Field label="Game server" value={baseUrl} onChange={setBaseUrl} /></View>}
    </> : !snapshot ? <><Text style={s.heading}>Connecting to your game…</Text><Button quiet title="Leave and stop tracking" onPress={() => void act(leave)} /></> : <>
      <View style={s.status}><Text style={s.label}>{connected ? 'Connected' : 'Reconnecting · state may be stale'}</Text><Text style={s.label}>{gps}</Text></View>
      {phase === 'lobby' ? <>
        <Text style={s.title}>Meet at the start.</Text><Text style={s.code}>{snapshot.code}</Text>
        <Button quiet title="Share invitation" onPress={() => void act(async () => { await Share.share({ message: `Join my Outrun game: ${invite} · Code ${snapshot.code}` }); })} />
        <View style={s.qr}><QRCode value={invite} size={130} /></View>
        <Text style={s.body}>{durationLabel(snapshot)} · {snapshot.area.radiusMeters} m area · {snapshot.radiusMeters} m capture radius</Text>
        <GameMap snapshot={snapshot} now={now} />
        <Text style={s.heading}>Your crew</Text>
        {snapshot.session.players.filter(p => !p.left).map(p => <View key={p.id} style={s.row}><View style={{ flex: 1 }}><Text style={s.heading}>{p.name}{p.id === player?.id ? ' (you)' : ''}</Text><Text style={s.body}>{p.role} · {p.ready ? 'Ready' : 'Not ready'}</Text></View>
          {isHost && <Button quiet disabled={busy} title={p.role === 'hunter' ? 'Make runner' : 'Make hunter'} onPress={() => void act(() => command('assign', { playerId: p.id, role: p.role === 'hunter' ? 'runner' : 'hunter' }))} />}</View>)}
        <Text style={s.heading}>{player?.role === 'hunter' ? 'Find every runner.' : 'Stay uncaptured until time runs out.'}</Text>
        <Text style={s.body}>Runners get a head start. Hunters see brief location reveals. Captures require a private photo and nearby GPS. You have 30 seconds to accept or dispute; the host has 2 minutes to review.</Text>
        <Text style={s.body}>Location is used for readiness and collected during play. Photos are visible to the players involved and the host during disputes. Your game expires after 24 hours.</Text>
        <Text style={s.body}>While ready, location checks refresh every 20 seconds. Turn off readiness to stop lobby checks.</Text>
        {isHost && <>
          <Button quiet title={creating ? 'Close rule editor' : 'Edit lobby timers'} onPress={() => setCreating(!creating)} />
          {creating && <View style={s.card}>
            <Field label="Hunting duration (minutes)" value={duration} onChange={setDuration} numeric />
            <Field label="Head start (minutes)" value={headStart} onChange={setHeadStart} numeric />
            <Field label="Reveal every (minutes)" value={interval} onChange={setIntervalMinutes} numeric />
            <Field label="Reveal visible (seconds)" value={windowSeconds} onChange={setWindowSeconds} numeric />
            <Button title="Save timers and reset readiness" disabled={busy || !connected} onPress={() => void act(async () => {
              await command('settings', { settings: { preparationMs: 10000, durationMs: Number(duration) * 60000,
                headStartMs: Number(headStart) * 60000, revealIntervalMs: Number(interval) * 60000, revealWindowMs: Number(windowSeconds) * 1000 } }); setCreating(false);
            })} />
          </View>}
        </>}
        <Button title={player?.ready ? 'Not ready' : 'Check GPS and ready up'} disabled={busy || !connected} onPress={() => void act(async () => { if (!player?.ready) await checkGps(); await command('ready', { ready: !player?.ready }); })} />
        {isHost && <Button title="Start Manhunt" disabled={busy || !connected || snapshot.session.players.filter(p => !p.left).length < 4 || !snapshot.session.players.filter(p => !p.left).every(p => p.ready)} onPress={() => void act(() => command('start'))} />}
      </> : <>
        <Text style={s.title}>{phase === 'cancelled' ? 'Game cancelled.' : phase === 'ended' ? `${snapshot.session.result?.winner === 'hunters' ? 'Hunters' : 'Runners'} win!` : player?.eliminated ? 'You’re out.' : phase === 'countdown' ? 'Get ready.' : phase === 'head_start' ? player?.role === 'runner' ? 'RUN!' : 'Give them a head start.' : player?.role === 'runner' ? 'Stay out of sight.' : 'The hunt is on.'}</Text>
        {deadlines && !['ended', 'cancelled'].includes(phase!) && <Text style={s.timer}>{time((phase === 'countdown' ? deadlines.runnersReleasedAt : phase === 'head_start' ? deadlines.huntStartsAt : deadlines.endsAt) - now)}</Text>}
        {activeTracking && <>
          <Text style={s.body}>{reveal ? `Runner reveal · ${time(reveal.expiresAt - now)} remaining` : `Next reveal in ${time(nextReveal - now)}`}</Text>
          <GameMap snapshot={snapshot} now={now} />
          {outside && <Text style={s.error}>Outside the playing area. Return safely; avoid hazards.</Text>}
          <Text style={s.body}>{background ? 'Tracking with screen locked enabled.' : 'Keep the app open for location updates.'}</Text>
          {Platform.OS !== 'web' && !background && <Button quiet title="Enable tracking with screen locked" onPress={() => void act(async () => {
            const permission = await Location.requestBackgroundPermissionsAsync(); if (!permission.granted) throw new Error('Allow background location in settings.');
            await startBackground({ baseUrl, membership: member, endsAt: deadlines!.endsAt - offset.current }); setBackground(true);
          })} />}
        </>}
        {phase === 'active' && player?.role === 'hunter' && !player.eliminated && <View style={s.card}>
          <Text style={s.heading}>Capture a runner</Text><Text style={s.body}>Stop safely. Choose the runner and take a photo without touching or blocking them.</Text>
          {snapshot.session.players.filter(p => p.role === 'runner' && !p.left && !p.eliminated).map(p => <Button key={p.id} quiet={targetId !== p.id} title={p.name} onPress={() => setTargetId(p.id)} />)}
          <Button title="Take photo" disabled={busy || !targetId || !connected} onPress={() => void act(takePhoto)} />
          {photo && <><Image source={{ uri: photo }} style={s.photo} /><Button title="Submit capture" disabled={busy || !connected} onPress={() => void act(async () => {
            await checkGps(); const blob = await (await fetch(photo)).blob(); const uploaded = await client.upload(blob);
            await command('capture', { targetId, evidenceId: uploaded.evidenceId }); setPhoto(undefined);
          })} /></>}
        </View>}
        {snapshot.session.captures.map(c => <View key={c.id} style={s.card}>
          <Text style={s.heading}>Capture · {c.status.replaceAll('_', ' ')}</Text>
          <Text style={s.body}>{snapshot.session.players.find(p => p.id === c.hunterId)?.name} → {snapshot.session.players.find(p => p.id === c.targetId)?.name}</Text>
          {c.evidenceId && <Image source={{ uri: baseUrl + client.path(`/evidence/${c.evidenceId}`), headers: { Authorization: `Bearer ${member.token}` } }} style={s.photo} />}
          {c.status === 'pending_response' && c.targetId === member.playerId && <><Text style={s.body}>Respond in {time(c.responseDeadline - now)}. No response confirms the capture.</Text>
            <Button title="Accept capture" disabled={busy || !connected} onPress={() => void act(() => command('accept_capture', { captureId: c.id }))} />
            <Button quiet title="Dispute capture" disabled={busy || !connected} onPress={() => void act(() => command('dispute_capture', { captureId: c.id }))} /></>}
          {c.status === 'disputed' && isHost && <><Text style={s.body}>Review within {time(c.reviewDeadline! - now)} or this attempt expires.</Text>
            <Button title="Confirm capture" disabled={busy || !connected} onPress={() => void act(() => command('review_capture', { captureId: c.id, approve: true }))} />
            <Button quiet title="Reject capture" disabled={busy || !connected} onPress={() => void act(() => command('review_capture', { captureId: c.id, approve: false }))} /></>}
        </View>)}
        {['ended', 'cancelled'].includes(phase!) && <>
          {snapshot.session.players.map(p => <View key={p.id} style={s.row}><Text style={s.heading}>{p.name}</Text><Text style={s.body}>{p.left ? 'Left' : p.eliminated ? 'Captured' : p.role === 'runner' ? 'Survived' : 'Hunter'}
            {p.role === 'hunter' ? ` · ${snapshot.results?.captureCounts[p.id] ?? 0} captures` : ` · ${time((snapshot.results?.survivalSeconds[p.id] ?? 0) * 1000)}`}</Text></View>)}
          <Button quiet title="Export results" onPress={() => void act(async () => { await Share.share({ message: JSON.stringify({ game: snapshot.code,
            result: snapshot.session.result, players: snapshot.session.players.map(p => ({ name: p.name, role: p.role,
              outcome: p.left ? 'left' : p.eliminated ? 'captured' : 'survived', captures: snapshot.results?.captureCounts[p.id], survivalSeconds: snapshot.results?.survivalSeconds[p.id] })) }, null, 2) }); })} />
          <Button title="Play again" onPress={() => void act(leave)} />
        </>}
      </>}
      {isHost && !['ended', 'cancelled'].includes(phase!) && <Button quiet title="Cancel game" disabled={busy || !connected} onPress={() => void act(() => command('abort'))} />}
      <Button quiet title="Leave and stop tracking" disabled={busy} onPress={() => void act(leave)} />
      <Button quiet title="Delete my game data" disabled={busy || !connected} onPress={() => {
        const remove = () => void act(async () => { await client.request(client.path('/membership'), { method: 'DELETE' }); await leave(); });
        if (Platform.OS === 'web') { if (window.confirm('Leave the game and delete your name, credential and photos? Shared outcome metadata will remain.')) remove(); }
        else Alert.alert('Delete your game data?', 'This leaves the game and removes your name, credential and photos. Shared outcome metadata remains.', [{ text: 'Keep my data', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: remove }]);
      }} />
      <Button quiet title="Open permission settings" onPress={() => { if (Platform.OS !== 'web') void SystemLinking.openSettings(); else setError('Use your browser site settings to allow location and camera.'); }} />
    </>}
    <Text style={s.footer}>Look up. Play fair. Meet again.</Text>
  </ScrollView></SafeAreaView>;
}
function durationLabel(snapshot: Snapshot) { return `${snapshot.session.settings.durationMs / 60000} min hunt + ${snapshot.session.settings.headStartMs / 60000} min head start`; }
const s = StyleSheet.create({
  brandBadge: { borderWidth: 1, borderColor: colors.line, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 30 }, brandBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: colors.ink },
  hero: { backgroundColor: colors.ink, padding: 26, paddingBottom: 24, borderRadius: 22, overflow: 'hidden', gap: 18 },
  eyebrow: { color: colors.lime, fontSize: 11, fontWeight: '800', letterSpacing: 1.8 },
  heroTitle: { color: colors.white, fontSize: 38, lineHeight: 41, letterSpacing: -1.5, fontWeight: '900', fontStyle: 'italic' },
  heroBody: { color: '#d3dfd5', fontSize: 16, lineHeight: 24, maxWidth: 300 },
  heroStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, heroStat: { color: colors.lime, fontSize: 12, fontWeight: '600', paddingVertical: 7, paddingHorizontal: 12, borderWidth: 1, borderColor: '#52705a', borderRadius: 30 },
  trackMark: { gap: 6, marginTop: 6, alignItems: 'flex-end' }, trackLine: { width: '100%', height: 5, borderRadius: 3, backgroundColor: colors.lime },
  sectionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }, pill: { color: colors.blue, fontSize: 9, fontWeight: '800', letterSpacing: 1, backgroundColor: '#edf3e6', padding: 7, borderRadius: 5 },
  codeInput: { fontSize: 25, letterSpacing: 5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  createIntro: { padding: 4, gap: 12 }, safety: { padding: 16, gap: 8, borderLeftWidth: 3, borderLeftColor: colors.blue, backgroundColor: '#e6ecdf', borderRadius: 6 }, small: { fontSize: 13, lineHeight: 20, color: colors.muted }, settingsToggle: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  safe: { flex: 1, backgroundColor: colors.paper }, page: { padding: 20, gap: 20, maxWidth: 720, width: '100%', alignSelf: 'center' },
  brand: { paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, wordmark: { fontSize: 32, fontWeight: '900', fontStyle: 'italic', letterSpacing: -1.5, color: colors.ink }, tag: { fontSize: 14, color: colors.muted, marginTop: 4 },
  title: { fontSize: 42, lineHeight: 46, fontWeight: '900', color: colors.ink, letterSpacing: -1.5 }, heading: { fontSize: 19, fontWeight: '700', color: colors.ink },
  body: { fontSize: 16, lineHeight: 24, color: colors.muted }, field: { gap: 6 }, label: { fontSize: 13, fontWeight: '700', color: colors.muted },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 15, fontSize: 18, color: colors.ink },
  button: { minHeight: 52, borderRadius: 10, backgroundColor: colors.blue, paddingHorizontal: 18, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  quiet: { backgroundColor: '#e5ebdf', borderWidth: 1, borderColor: colors.line }, disabled: { backgroundColor: '#e3e8df' }, buttonText: { fontSize: 16, fontWeight: '700', color: colors.white }, card: { backgroundColor: colors.white, padding: 22, borderRadius: 18, gap: 14, borderWidth: 1, borderColor: colors.line },
  code: { fontSize: 48, fontWeight: '900', letterSpacing: 6, color: colors.blue }, timer: { fontSize: 72, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
  qr: { alignItems: 'center', padding: 20, backgroundColor: colors.white, borderRadius: 20 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.line },
  status: { gap: 8, padding: 14, backgroundColor: '#e5ebdf', borderRadius: 10 }, error: { padding: 15, backgroundColor: '#ffebe5', color: '#963b2b', borderRadius: 12, fontSize: 16 }, photo: { width: '100%', height: 230, borderRadius: 14 }, footer: { color: colors.muted, textAlign: 'center', paddingVertical: 24 },
});
