import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="p-3 rounded-full bg-destructive/10">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-bold text-foreground mb-1">Something went wrong</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
          </div>
          <Button variant="outline" onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
