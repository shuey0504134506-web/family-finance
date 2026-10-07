import { Component, type ErrorInfo, type ReactNode } from 'react';
import { FullScreenMessage } from './FullScreenMessage';

interface State {
  failed: boolean;
}

/** תופס שגיאות תצוגה בלתי צפויות, כדי שלא יוצג מסך לבן. הנתונים עצמם שמורים ב-Firestore. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI error', error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <FullScreenMessage title="משהו השתבש">
          <p className="muted">הנתונים שלך שמורים. אפשר לטעון את האפליקציה מחדש.</p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            טעינה מחדש
          </button>
        </FullScreenMessage>
      );
    }
    return this.props.children;
  }
}
