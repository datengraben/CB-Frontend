import camelcaseKeys from 'camelcase-keys';
import { createApp } from 'vue';
import { createI18n } from 'petite-vue-i18n';

import CBCommonsSearch from './components/CBCommonsSearch.vue';
import type { CommonsSearchConfiguration } from './types';

export default function (element: HTMLElement, config: CommonsSearchConfiguration) {
  const parsedConfig = camelcaseKeys<CommonsSearchConfiguration>(config, {
    deep: true,
  });

  const i18n = createI18n({
    locale: parsedConfig.locale,
    fallbackLocale: 'en',
    fallbackWarn: false,
    missingWarn: false,
  });
  const app = createApp(CBCommonsSearch, { config: parsedConfig });
  app.use(i18n);
  app.mount(element);
}
