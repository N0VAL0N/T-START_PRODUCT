import { Component } from 'react';

// Ловит ошибки рендера в поддереве и показывает аккуратный экран вместо белого.
// Особенно полезно для ленивых чанков (Story/ChatModal и т.п.) при сбое загрузки.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    // Полная перезагрузка помогает, если сломался именно lazy-чанк.
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-yellow-400 text-black flex items-center justify-center text-3xl mb-4">!</div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Что-то пошло не так</h2>
        <p className="text-sm text-gray-500 max-w-sm mb-4">
          Раздел не удалось загрузить. Попробуй обновить — данные твоего аккаунта сохранены.
        </p>
        <button onClick={this.handleReload} className="bg-yellow-400 text-black font-bold px-5 py-2.5 rounded-xl hover:bg-yellow-500 transition-colors">
          Обновить
        </button>
      </div>
    );
  }
}
