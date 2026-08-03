// Cross-platform alert/confirm.
// react-native-web implementa Alert.alert() como um no-op (não mostra nada e
// nunca chama os botões), então na web toda confirmação (ex: deletar) travava
// silenciosamente. Aqui caímos para window.alert/window.confirm nesse caso.
import { Alert, AlertButton, Platform } from 'react-native';

export function alert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  const text = message ? `${title}\n\n${message}` : title;

  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }

  const cancelButton = buttons.find((b) => b.style === 'cancel');
  const confirmButton = buttons.find((b) => b !== cancelButton) ?? buttons[buttons.length - 1];

  if (window.confirm(text)) {
    confirmButton.onPress?.();
  } else {
    cancelButton?.onPress?.();
  }
}
