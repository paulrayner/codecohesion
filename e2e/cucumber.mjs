export default {
  requireModule: ['tsx'],
  require: [
    'e2e/support/**/*.ts',
    'e2e/step-definitions/**/*.ts',
  ],
  paths: ['e2e/features/**/*.feature'],
  format: [
    'summary',
    'html:e2e/reports/report.html',
  ],
  publishQuiet: true,
};
