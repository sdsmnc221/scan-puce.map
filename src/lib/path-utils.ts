const getUrlParams = (param: string) => {
  const urlParams = new URLSearchParams(window.location.search);
  const result = urlParams.get(param);
  return { param, result };
};

const getAllUrlParams = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const params: Record<string, string> = {};
  urlParams.forEach((value, key) => {
    params[key] = value;
  });

  return params;
};

const clearUrlParams = (param: string) => {
  const urlParams = new URLSearchParams(window.location.search);
  urlParams.delete(param);
};

export { getUrlParams, getAllUrlParams, clearUrlParams };
