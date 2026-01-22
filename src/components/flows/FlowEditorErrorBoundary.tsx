import React from "react";
import { Button } from "@/components/ui/button";

type Props = {
  children: React.ReactNode;
  title?: string;
  onBack?: () => void;
};

type State = {
  hasError: boolean;
  error?: Error;
};

/**
 * Evita o cenário “tela vazia” caso o editor quebre por algum erro runtime.
 * Mantém o usuário com um caminho claro de volta.
 */
export class FlowEditorErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("FlowEditor crashed:", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="w-full rounded-xl border border-border bg-card p-6">
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">
            O editor não conseguiu carregar
          </h2>
          <p className="text-sm text-muted-foreground">
            Ocorreu um erro inesperado ao renderizar o canvas. Você pode voltar e abrir o
            fluxo novamente.
          </p>
          {this.state.error?.message && (
            <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs text-foreground">
              {this.state.error.message}
            </pre>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {this.props.onBack && (
            <Button variant="outline" onClick={this.props.onBack}>
              Voltar para Fluxos
            </Button>
          )}
          <Button
            onClick={() => {
              this.setState({ hasError: false, error: undefined });
            }}
          >
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }
}
