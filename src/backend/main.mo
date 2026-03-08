import Map "mo:core/Map";
import Array "mo:core/Array";
import Runtime "mo:core/Runtime";
import Text "mo:core/Text";
import Principal "mo:core/Principal";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";
import Migration "migration";

(with migration = Migration.run)
actor {
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  public type UserProfile = {
    name : Text;
  };

  public type OrderStatus = {
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

  let orders = Map.empty<Text, OrderStatus>();
  let userProfiles = Map.empty<Principal, UserProfile>();

  // User profile functions with auth checks
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // Order management functions (NO auth checks)
  public shared ({ caller }) func upsertOrder(order : OrderStatus) : async () {
    orders.add(order.orderId, order);
  };

  public shared ({ caller }) func bulkUpsertOrders(ordersArray : [OrderStatus]) : async () {
    for (order in ordersArray.values()) {
      orders.add(order.orderId, order);
    };
  };

  public shared ({ caller }) func deleteOrder(orderId : Text) : async () {
    orders.remove(orderId);
  };

  public query ({ caller }) func getOrder(_orderId : Text) : async ?OrderStatus {
    orders.get(_orderId);
  };

  public query ({ caller }) func getAllOrders() : async [OrderStatus] {
    orders.values().toArray();
  };
};
