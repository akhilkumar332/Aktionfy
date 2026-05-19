export const decodeBase64 = (str) => {
  if (!str) return '';
  try {
    const binary = atob(str);
    try {
      return decodeURIComponent(binary.split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
    } catch {
      return binary;
    }
  } catch {
    return str;
  }
};

export const parseJSONField = (field, defaultValue) => {
  if (!field) return defaultValue;
  if (typeof field === 'object') return field;
  
  const strField = String(field);
  
  try {
    const decoded = decodeBase64(strField);
    if (decoded.startsWith('{') || decoded.startsWith('[')) {
      return JSON.parse(decoded);
    }
  } catch {
    // ignore
  }

  try {
    return JSON.parse(strField);
  } catch {
    return defaultValue;
  }
};

export const validateStep = (step, formData) => {
  switch (step) {
    case 1:
      // Name must exist and not contain spaces
      return !!formData.name && !/\s/.test(formData.name) && !!formData.workspace_id;
    case 2:
      if (formData.task_type === 'mcp_sampling') return !!formData.agent_prompt;
      if (formData.task_type === 'native_action') return !!formData.native_code;
      if (formData.task_type === 'decision_router') return !!formData.agent_prompt;
      if (formData.task_type === 'swarm_router') {
        return formData.swarm_config?.council?.length > 0 && 
               formData.swarm_config.council.every(a => !!a.name && !!a.prompt);
      }
      return true;
    case 3:
      // Step 3 is mostly optional (Dependency Link)
      return true;
    case 4:
      if (formData.trigger_type === 'cron') return !!formData.trigger_config?.cron;
      if (formData.trigger_type === 'interval') return !!formData.trigger_config?.minutes;
      return true;
    case 5:
      return true;
    default:
      return false;
  }
};
