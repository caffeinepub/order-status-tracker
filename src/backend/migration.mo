import Map "mo:core/Map";
import Text "mo:core/Text";
import Principal "mo:core/Principal";

module {
  type OldActor = {
    orders : Map.Map<Text, {
      orderId : Text;
      status1 : Text;
      status2 : Text;
      status3 : Text;
      status4 : Text;
      status5 : Text;
      status6 : Text;
      status7 : Text;
      status8 : Text;
      status9 : Text;
      status10 : Text;
      status11 : Text;
      status12 : Text;
      status13 : Text;
      status14 : Text;
      status15 : Text;
      status16 : Text;
      status17 : Text;
      status18 : Text;
      status19 : Text;
      status20 : Text;
      status21 : Text;
    }>;
    userProfiles : Map.Map<Principal, { name : Text }>;
  };

  type NewActor = {
    orders : Map.Map<Text, {
      orderId : Text;
      status1 : Text;
      status2 : Text;
      status3 : Text;
      status4 : Text;
      status5 : Text;
      status6 : Text;
      status7 : Text;
      status8 : Text;
      status9 : Text;
      status10 : Text;
      status11 : Text;
      status12 : Text;
      status13 : Text;
      status14 : Text;
      status15 : Text;
      status16 : Text;
      status17 : Text;
      status18 : Text;
      status19 : Text;
      status20 : Text;
      status21 : Text;
    }>;
    userProfiles : Map.Map<Principal, { name : Text }>;
    appConfigs : Map.Map<Text, Text>;
  };

  public func run(old : OldActor) : NewActor {
    let newAppConfigs = Map.empty<Text, Text>();
    {
      old with
      appConfigs = newAppConfigs
    };
  };
};
