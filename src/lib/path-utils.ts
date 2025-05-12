const getUrlParams = (param: string) => {
  const urlParams = new URLSearchParams(window.location.search);
  const result = urlParams.get(param);
  return { param, result };
};

const clearUrlParams = (param: string) => {
  const urlParams = new URLSearchParams(window.location.search);
  urlParams.delete(param);
};

export { getUrlParams, clearUrlParams };
