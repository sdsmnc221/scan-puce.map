declare module "*.csv" {
  const content: {
    postcode: string;
    commune: string;
    longitude: string;
    latitude: string;
    result_score: string;
    result_score_next: string;
    result_label: string;
    result_type: string;
    result_id: string;
    result_housenumber: string;
    result_name: string;
    result_street: string;
    result_postcode: string;
    result_city: string;
    result_context: string;
    result_citycode: string;
    result_oldcitycode: string;
    result_oldcity: string;
    result_district: string;
    result_status: string;
  }[];
  export default content;
}
