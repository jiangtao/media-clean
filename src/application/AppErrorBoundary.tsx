import React from 'react';
import { StyleSheet, View } from 'react-native';

import {
  detectPreferredAppLanguage,
  type AppLanguage,
} from '../i18n/app-language';
import { getAppCopy } from '../i18n/app-copy';
import { OBSERVABILITY_EVENTS } from '../services/observability/observability';
import { getAppTheme } from '../theme/app-theme';
import { Button, Card, Text } from '../ui/primitives';
import { getAppObservability } from './observability';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
  language?: AppLanguage;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    getAppObservability().trackError(OBSERVABILITY_EVENTS.appRenderError, error, {
      has_component_stack: info.componentStack ? 'true' : 'false',
    });
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      const language = this.props.language ?? detectPreferredAppLanguage();
      const copy = getAppCopy(language).appErrorBoundary;
      const theme = getAppTheme('dark');

      return (
        <View style={[styles.container, { backgroundColor: theme.safeArea }]}>
          <Card variant="muted" theme={theme} style={styles.card}>
            <Text variant="title" theme={theme} style={styles.title}>
              {copy.title}
            </Text>
            <Text variant="body" tone="secondary" theme={theme} style={styles.body}>
              {copy.body}
            </Text>
            <Button onPress={this.handleRetry} variant="tertiary" theme={theme} style={styles.button}>
              {copy.retry}
            </Button>
          </Card>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  title: {
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    minWidth: 120,
  },
});
