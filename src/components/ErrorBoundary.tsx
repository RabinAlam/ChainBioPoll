import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-dark-950 bg-mesh flex items-center justify-center p-4">
          <div className="glass-card p-10 text-center max-w-md w-full">
            <span className="text-5xl mb-4 block">💥</span>
            <h1 className="text-xl font-bold text-dark-100 mb-2">Something went wrong</h1>
            <p className="text-dark-400 text-sm mb-6">
              An unexpected error occurred. Please refresh the page or contact the Election Commission.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
