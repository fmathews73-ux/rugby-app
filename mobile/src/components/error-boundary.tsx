import { Component, type ReactNode } from 'react';

/**
 * Minimal error boundary. Wraps something that might blow up (e.g. the
 * WebGL context of TeamFlagBall3D) and renders a fallback instead of
 * bringing the whole screen down.
 */
interface Props {
  children: ReactNode;
  fallback: ReactNode;
  /** Optional side-effect on catch. Useful for logging in dev. */
  onError?: (error: unknown) => void;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown): void {
    this.props.onError?.(error);
  }

  override render(): ReactNode {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
