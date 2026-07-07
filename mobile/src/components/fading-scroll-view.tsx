import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef, useCallback, useRef } from 'react';
import {
  Animated,
  FlatList,
  type FlatListProps,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
  View,
} from 'react-native';

// Page surface (PageGradient's flat #FAFAFA) — the edges dissolve
// scrolling content into it.
const PAGE_BG_SOLID = 'rgba(250, 250, 250, 1)';
const PAGE_BG_CLEAR = 'rgba(250, 250, 250, 0)';
const FADE_HEIGHT = 72;
const FADE_MS = 180;
// A fade only shows when at least this much content is hidden past its
// edge — at the very top the hero reads clean, fully scrolled down the
// carousel dots read clean.
const EDGE_SLACK = 6;

type ScrollHandler = (e: NativeSyntheticEvent<NativeScrollEvent>) => void;

interface EdgeFadeScrollProps {
  onScroll?: ScrollHandler;
  onLayout?: (e: LayoutChangeEvent) => void;
  onContentSizeChange?: (w: number, h: number) => void;
}

/** Position-aware persistent fades: each edge's fade is visible only
 *  while content is actually hidden beyond that edge. */
function useEdgeFades(props: EdgeFadeScrollProps) {
  const topFade = useRef(new Animated.Value(0)).current;
  const bottomFade = useRef(new Animated.Value(0)).current;
  const topShown = useRef(false);
  const bottomShown = useRef(false);
  const offsetY = useRef(0);
  const viewportH = useRef(0);
  const contentH = useRef(0);

  const animate = useCallback((v: Animated.Value, to: number) => {
    Animated.timing(v, { toValue: to, duration: FADE_MS, useNativeDriver: true }).start();
  }, []);

  const update = useCallback(() => {
    const top = offsetY.current > EDGE_SLACK;
    const bottom =
      contentH.current - viewportH.current - offsetY.current > EDGE_SLACK;
    if (top !== topShown.current) {
      topShown.current = top;
      animate(topFade, top ? 1 : 0);
    }
    if (bottom !== bottomShown.current) {
      bottomShown.current = bottom;
      animate(bottomFade, bottom ? 1 : 0);
    }
  }, [animate, topFade, bottomFade]);

  const handlers = {
    scrollEventThrottle: 32,
    onScroll: ((e) => {
      offsetY.current = e.nativeEvent.contentOffset.y;
      update();
      props.onScroll?.(e);
    }) as ScrollHandler,
    onLayout: (e: LayoutChangeEvent) => {
      viewportH.current = e.nativeEvent.layout.height;
      update();
      props.onLayout?.(e);
    },
    onContentSizeChange: (w: number, h: number) => {
      contentH.current = h;
      update();
      props.onContentSizeChange?.(w, h);
    },
  };
  return { topFade, bottomFade, handlers };
}

/** The two gradient overlays, opacity-driven per edge. */
function EdgeFadeOverlays({
  topFade,
  bottomFade,
}: {
  topFade: Animated.Value;
  bottomFade: Animated.Value;
}) {
  return (
    <>
      <Animated.View style={[styles.topFade, { opacity: topFade }]} pointerEvents="none">
        <LinearGradient
          colors={[PAGE_BG_SOLID, PAGE_BG_CLEAR]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View style={[styles.bottomFade, { opacity: bottomFade }]} pointerEvents="none">
        <LinearGradient
          colors={[PAGE_BG_CLEAR, PAGE_BG_SOLID]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </>
  );
}

/**
 * ScrollView with scroll-activity edge fades: WHILE the content moves,
 * cards dissolve under the chrome at the top and bottom of the
 * viewport; once scrolling settles the fades clear so nothing sits
 * between the user and the page. Pure opacity transform on the native
 * driver — no layout animation.
 */
export const FadingScrollView = forwardRef<ScrollView, ScrollViewProps>(
  function FadingScrollView({ children, ...props }, ref) {
    const { topFade, bottomFade, handlers } = useEdgeFades(props);
    return (
      <View style={styles.host}>
        <ScrollView ref={ref} {...props} {...handlers}>
          {children}
        </ScrollView>
        <EdgeFadeOverlays topFade={topFade} bottomFade={bottomFade} />
      </View>
    );
  },
);

/** FlatList sibling — same behaviour for the list-based landing pages. */
function FadingFlatListInner<T>(
  props: FlatListProps<T>,
  ref: React.Ref<FlatList<T>>,
) {
  const { topFade, bottomFade, handlers } = useEdgeFades(props);
  return (
    <View style={styles.host}>
      <FlatList<T> ref={ref} {...props} {...handlers} />
      <EdgeFadeOverlays topFade={topFade} bottomFade={bottomFade} />
    </View>
  );
}

export const FadingFlatList = forwardRef(FadingFlatListInner) as <T>(
  props: FlatListProps<T> & { ref?: React.Ref<FlatList<T>> },
) => React.ReactElement;

const styles = StyleSheet.create({
  host: { flex: 1 },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: FADE_HEIGHT,
  },
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: FADE_HEIGHT,
  },
});
