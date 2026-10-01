export const requireTrustedWebhook = (req, res, next) => {
  // We currently have no secure webhook signature or provider mapping for these routes.
  // X-Tenant-DB is unverified and cannot be trusted for external writes.
  // Failing closed as required by security policy.
  return res.status(403).json({
    status: 'error',
    message: 'Webhook authentication required. Provider-specific webhook authentication/mapping is a prerequisite for enabling tenant-specific writes.'
  });
};
