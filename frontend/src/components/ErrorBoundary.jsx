import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, errorMessage: '' };
    }

    static getDerivedStateFromError(error) {
        return {
            hasError: true,
            errorMessage: error?.message || 'Unexpected UI error occurred.',
        };
    }

    componentDidCatch(error, info) {
        // Keep error details in console for debugging while showing a safe fallback UI.
        console.error('Unhandled UI error:', error, info);
    }

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
                    <div className="max-w-xl w-full bg-white border border-red-200 rounded-xl p-8 shadow-sm">
                        <h1 className="text-2xl font-bold text-red-700 mb-3">Something went wrong</h1>
                        <p className="text-gray-700 mb-2">The app hit an unexpected error, but your wallet and on-chain data are safe.</p>
                        <p className="text-sm text-gray-500 mb-6 break-words">Error: {this.state.errorMessage}</p>
                        <button type="button" onClick={this.handleReload} className="btn-primary">
                            Reload App
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;