import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AppState,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Adfacten,
  AdfactenBanner,
  AdfactenNativeAd,
  AppOpenAd,
  InterstitialAd,
  RewardedAd,
  isAdfactenError,
  type BannerSize,
} from '@adfacten/react-native-ads';
import { TEST_APP } from './testApp';

// Initialize once, before any ad is requested.
Adfacten.initialize(TEST_APP.appKey, { testMode: true, logLevel: 'debug' });

type LogLine = { id: number; text: string };

function describe(e: unknown): string {
  if (isAdfactenError(e)) {
    return `${e.errorName}${e.serverCode ? ` (${e.serverCode})` : ''}: ${e.message}`;
  }
  return String(e);
}

export default function App() {
  const [log, setLog] = useState<LogLine[]>([]);
  const add = useCallback((text: string) => {
    console.log(`[example] ${text}`);
    setLog((l) =>
      [{ id: Date.now() + Math.random(), text }, ...l].slice(0, 40)
    );
  }, []);

  useEffect(() => {
    Adfacten.getSdkVersion().then(
      (v) => add(`Adfacten SDK ${v} (${Platform.OS})`),
      (e) => add(`getSdkVersion failed: ${describe(e)}`)
    );
  }, [add]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.h1}>Adfacten Ads</Text>
        <Text style={styles.note}>
          Public test app: test ads only, never billed.
        </Text>

        <BannerSection log={add} />
        <InterstitialSection log={add} />
        <RewardedSection log={add} />
        <AppOpenSection log={add} />
        <NativeSection log={add} />

        <Text style={styles.h2}>Events</Text>
        {log.map((l) => (
          <Text key={l.id} style={styles.log}>
            {l.text}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

type SectionProps = { log: (text: string) => void };

const BANNER_SIZES: BannerSize[] = ['banner', 'largeBanner', 'mediumRectangle'];

function BannerSection({ log }: SectionProps) {
  const [size, setSize] = useState<BannerSize>('banner');
  return (
    <Section title="Banner">
      <View style={styles.row}>
        {BANNER_SIZES.map((s) => (
          <Button
            key={s}
            title={s}
            active={s === size}
            onPress={() => setSize(s)}
          />
        ))}
      </View>
      <AdfactenBanner
        key={size}
        placementId={TEST_APP.banner}
        size={size}
        style={styles.center}
        onLoad={() => log(`banner ${size}: loaded`)}
        onError={(e) => log(`banner ${size}: ${describe(e)}`)}
        onImpression={() => log(`banner ${size}: impression`)}
        onClick={() => log(`banner ${size}: clicked`)}
      />
    </Section>
  );
}

function InterstitialSection({ log }: SectionProps) {
  const [ad, setAd] = useState<InterstitialAd | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const loaded = await InterstitialAd.load(TEST_APP.interstitial);
      loaded.addListener('shown', () => log('interstitial: shown'));
      loaded.addListener('clicked', () => log('interstitial: clicked'));
      loaded.addListener('closed', () => {
        log('interstitial: closed');
        setAd(null);
      });
      loaded.addListener('failedToShow', (e) =>
        log(`interstitial: failed to show, ${describe(e)}`)
      );
      setAd(loaded);
      log('interstitial: loaded');
    } catch (e) {
      log(`interstitial: ${describe(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Interstitial">
      <View style={styles.row}>
        <Button
          title={busy ? 'Loading...' : 'Load'}
          disabled={busy}
          onPress={load}
        />
        <Button
          title="Show"
          disabled={!ad}
          onPress={() =>
            ad?.show().catch((e) => log(`interstitial: ${describe(e)}`))
          }
        />
      </View>
    </Section>
  );
}

function RewardedSection({ log }: SectionProps) {
  const [ad, setAd] = useState<RewardedAd | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const loaded = await RewardedAd.load(TEST_APP.rewarded, {
        customData: 'level=3',
      });
      loaded.addListener('shown', () => log('rewarded: shown'));
      loaded.addListener('closed', () => {
        log('rewarded: closed');
        setAd(null);
      });
      setAd(loaded);
      const r = loaded.reward;
      log(`rewarded: loaded${r ? `, reward ${r.amount} ${r.type}` : ''}`);
    } catch (e) {
      log(`rewarded: ${describe(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const show = () => {
    ad?.show({
      // UX only: credit the user from your server-side reward callback.
      onUserEarnedReward: (r) => log(`rewarded: earned ${r.amount} ${r.type}`),
    }).catch((e) => log(`rewarded: ${describe(e)}`));
  };

  return (
    <Section title="Rewarded">
      <View style={styles.row}>
        <Button
          title={busy ? 'Loading...' : 'Load'}
          disabled={busy}
          onPress={load}
        />
        <Button title="Show" disabled={!ad} onPress={show} />
      </View>
    </Section>
  );
}

function AppOpenSection({ log }: SectionProps) {
  const ad = useRef<AppOpenAd | null>(null);
  const [ready, setReady] = useState(false);
  const [showOnForeground, setShowOnForeground] = useState(false);

  const load = useCallback(async () => {
    try {
      const loaded = await AppOpenAd.load(TEST_APP.appOpen);
      loaded.addListener('closed', () => {
        log('app open: closed');
        ad.current = null;
        setReady(false);
      });
      ad.current = loaded;
      setReady(true);
      log('app open: loaded');
    } catch (e) {
      log(`app open: ${describe(e)}`);
    }
  }, [log]);

  // Typical use: show a preloaded ad when the user returns to the app.
  useEffect(() => {
    if (!showOnForeground) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && ad.current?.isReady) {
        ad.current.show().catch((e) => log(`app open: ${describe(e)}`));
      }
    });
    return () => sub.remove();
  }, [showOnForeground, log]);

  return (
    <Section title="App open">
      <View style={styles.row}>
        <Button title="Load" onPress={load} />
        <Button
          title="Show"
          disabled={!ready}
          onPress={() =>
            ad.current?.show().catch((e) => log(`app open: ${describe(e)}`))
          }
        />
        <Button
          title={showOnForeground ? 'On resume: on' : 'On resume: off'}
          active={showOnForeground}
          onPress={() => setShowOnForeground((v) => !v)}
        />
      </View>
    </Section>
  );
}

function NativeSection({ log }: SectionProps) {
  return (
    <Section title="Native">
      <Text style={styles.caption}>medium template</Text>
      <AdfactenNativeAd
        placementId={TEST_APP.native}
        template="medium"
        style={styles.nativeAd}
        onLoad={(a) => log(`native medium: loaded "${a.title}"`)}
        onError={(e) => log(`native medium: ${describe(e)}`)}
        onImpression={() => log('native medium: impression')}
        onClick={() => log('native medium: clicked')}
      />
      <Text style={styles.caption}>small template, custom colors</Text>
      <AdfactenNativeAd
        placementId={TEST_APP.native}
        template="small"
        appearance={{
          titleColor: '#ffffff',
          bodyColor: '#d0d4dc',
          secondaryColor: '#9aa3b2',
          callToActionColor: '#ff7a00',
          callToActionTextColor: '#ffffff',
          callToActionCornerRadius: 18,
        }}
        style={[styles.nativeAd, styles.dark]}
        onLoad={(a) => log(`native small: loaded "${a.title}"`)}
        onError={(e) => log(`native small: ${describe(e)}`)}
        onImpression={() => log('native small: impression')}
        onClick={() => log('native small: clicked')}
      />
    </Section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.h2}>{title}</Text>
      {children}
    </View>
  );
}

function Button({
  title,
  onPress,
  disabled,
  active,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        active && styles.buttonActive,
        (pressed || disabled) && styles.buttonDim,
      ]}
    >
      <Text style={[styles.buttonText, active && styles.buttonTextActive]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f7f9' },
  content: { padding: 16, paddingTop: 64, paddingBottom: 48 },
  h1: { fontSize: 24, fontWeight: '700', color: '#111' },
  h2: { fontSize: 17, fontWeight: '600', color: '#111', marginBottom: 8 },
  note: { fontSize: 13, color: '#666', marginTop: 4, marginBottom: 8 },
  caption: { fontSize: 12, color: '#666', marginVertical: 6 },
  section: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  center: { alignSelf: 'center' },
  nativeAd: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e3e5e8',
  },
  dark: { backgroundColor: '#1c2230', borderColor: '#1c2230' },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#e8eefc',
  },
  buttonActive: { backgroundColor: '#1a73e8' },
  buttonDim: { opacity: 0.5 },
  buttonText: { color: '#1a4fb8', fontWeight: '600', fontSize: 13 },
  buttonTextActive: { color: '#fff' },
  log: {
    fontSize: 12,
    color: '#333',
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
});
