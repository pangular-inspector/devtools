// src/main.ts
import { AppRegistry, Image, Platform, processColor } from 'react-native';
import { mount } from '@ng-native/platform';
import { getFabricUIManager, registerPlatformComponents } from '@ng-native/fabric';
import { initAngularNativeOverlay } from '@pangular-inspector/devtools/overlay-angular-native';
import { App } from './app/app.ts';

registerPlatformComponents(Platform.OS);

AppRegistry.registerRunnable('main', ({ rootTag }: { rootTag: number | string }) => {
  const app = mount(Number(rootTag), App, getFabricUIManager(), {
    processColor,
    resolveAssetSource: (value) => Image.resolveAssetSource(value as never),
  });
  if (__DEV__) initAngularNativeOverlay({ root: app.engine.root });
});
