import Map "mo:core/Map";
import Principal "mo:core/Principal";

module {
  // Old types
  type OldUserProfile = {
    name : Text;
  };

  type OldOrderStatus = {
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
  };

  type OldActor = {
    orders : Map.Map<Text, OldOrderStatus>;
    userProfiles : Map.Map<Principal, OldUserProfile>;
  };

  // New types
  type NewUserProfile = {
    name : Text;
  };

  type NewOrderStatus = {
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
  };

  type NewActor = {
    orders : Map.Map<Text, NewOrderStatus>;
    userProfiles : Map.Map<Principal, NewUserProfile>;
  };

  public func run(old : OldActor) : NewActor {
    let newOrders = old.orders.map<Text, OldOrderStatus, NewOrderStatus>(
      func(_orderId, oldOrder) {
        { oldOrder with
          status12 = "";
          status13 = "";
          status14 = "";
          status15 = "";
          status16 = "";
          status17 = "";
          status18 = "";
          status19 = "";
          status20 = "";
          status21 = "";
        };
      }
    );
    {
      old with
      orders = newOrders;
    };
  };
};
