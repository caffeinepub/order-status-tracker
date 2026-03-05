import Map "mo:core/Map";
import Array "mo:core/Array";
import Runtime "mo:core/Runtime";
import Text "mo:core/Text";
import Principal "mo:core/Principal";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

actor {
  // Initialize the access control state
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // User profile type
  public type UserProfile = {
    name : Text;
  };

  // User profiles storage
  let userProfiles = Map.empty<Principal, UserProfile>();

  // Order type
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
  };

  // Orders storage
  let orders = Map.empty<Text, OrderStatus>();

  // User profile management functions
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

  // Order management functions WITHOUT access control checks
  public shared ({}) func upsertOrder(order : OrderStatus) : async () {
    orders.add(order.orderId, order);
  };

  public shared ({}) func bulkUpsertOrders(ordersArray : [OrderStatus]) : async () {
    for (order in ordersArray.values()) {
      orders.add(order.orderId, order);
    };
  };

  public shared ({}) func deleteOrder(orderId : Text) : async () {
    if (not orders.containsKey(orderId)) {
      Runtime.trap("Order does not exist");
    };
    orders.remove(orderId);
  };

  public query ({}) func getOrder(orderId : Text) : async ?OrderStatus {
    orders.get(orderId);
  };

  public query ({}) func getAllOrders() : async [OrderStatus] {
    orders.values().toArray();
  };
};
