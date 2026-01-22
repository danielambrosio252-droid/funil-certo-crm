import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, ArrowLeft } from "lucide-react";

interface Props {
  children: React.ReactNode;
  onBack: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class FlowEditorErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("FlowEditor Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex items-center justify-center p-8">
          <Card className="max-w-md">
            <CardContent className="flex flex-col items-center text-center p-6">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Erro no Editor</h3>
              <p className="text-muted-foreground mb-4">
                Ocorreu um erro ao carregar o editor de fluxos. 
                Por favor, volte e tente novamente.
              </p>
              <pre className="text-xs text-left bg-muted p-2 rounded mb-4 max-w-full overflow-auto">
                {this.state.error?.message}
              </pre>
              <Button onClick={this.props.onBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
