'use client'

import { Component, ReactNode } from 'react'

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="m-6 rounded-apple-lg border border-hairline bg-white p-6">
          <h2 className="text-lg font-semibold text-ink">문제가 발생했습니다</h2>
          <p className="mt-2 text-sm text-ink-muted-48">페이지를 새로고침한 뒤 다시 시도해주세요.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-full bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-focus"
          >
            새로고침
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
