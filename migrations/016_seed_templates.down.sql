-- Since these are seed data without specific identifiable IDs initially, 
-- we can just truncate or delete rows that match our specific seed names.
-- However, for safety in production, we typically don't delete seeded templates.
-- We can delete by the names we inserted.

DELETE FROM templates WHERE name IN (
    'Daily Standup Summarizer',
    'Weekly GitHub PR Review',
    'Customer Support Sentiment Analyzer',
    'Website Health Monitor',
    'SEO Keyword Rank Tracker',
    'Monthly Invoice Dispatch',
    'Social Media Content Scheduler',
    'Stale Branch Cleanup',
    'Competitor Pricing Tracker',
    'New User Onboarding Email',
    'Cloud Cost Anomaly Alert',
    'Meeting Notes Extractor',
    'Error Log Anomaly Detector',
    'HackerNews Top 10 Digest',
    'Jira Stale Issue Nag',
    'Newsletter Draft Generator',
    'CRM Lead Enrichment',
    'Daily Weather Briefing'
);