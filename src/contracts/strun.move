// Strun Smart Contract for Sui Blockchain
// This contract manages territories, XP tokens, and rent payments

module strun::territory {
    use std::string::{Self, String};
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::event;
    use sui::table::{Self, Table};
    use sui::clock::{Self, Clock};

    // ===== Constants =====
    const MIN_TERRITORY_SIZE: u64 = 100; // Minimum 100 meters
    const RENT_PERCENTAGE: u64 = 10; // 10% of claim cost
    const XP_PER_METER: u64 = 1;
    const PENALTY_MULTIPLIER: u64 = 2;
    
    // ===== Error Codes =====
    const E_INSUFFICIENT_BALANCE: u64 = 0;
    const E_TERRITORY_TOO_SMALL: u64 = 1;
    const E_NOT_TERRITORY_OWNER: u64 = 2;
    const E_ALREADY_CLAIMED: u64 = 3;
    const E_INVALID_COORDINATES: u64 = 4;

    // ===== Structs =====
    
    /// XP Token for the game
    struct XP has store, drop {
        amount: u64
    }

    /// Territory NFT
    struct Territory has key, store {
        id: UID,
        name: String,
        owner: address,
        coordinates: vector<Coordinate>,
        area: u64,
        rent_price: u64,
        total_rent_collected: u64,
        claimed_at: u64,
        visits: u64
    }

    /// Coordinate for territory boundaries
    struct Coordinate has store, drop, copy {
        lat: u64,
        lng: u64
    }

    /// User profile
    struct UserProfile has key, store {
        id: UID,
        owner: address,
        username: String,
        xp_balance: Balance<XP>,
        total_distance: u64,
        territories_owned: u64,
        total_runs: u64,
        created_at: u64
    }

    /// Game state
    struct GameState has key {
        id: UID,
        territories: Table<ID, address>,
        total_territories: u64,
        total_xp_minted: u64,
        total_rent_paid: u64
    }

    /// Run session
    struct RunSession has key, store {
        id: UID,
        runner: address,
        start_time: u64,
        end_time: u64,
        distance: u64,
        path: vector<Coordinate>,
        xp_earned: u64,
        territories_crossed: vector<ID>
    }

    // ===== Events =====
    
    struct TerritoryClaimedEvent has copy, drop {
        territory_id: ID,
        owner: address,
        area: u64,
        xp_earned: u64
    }

    struct RentPaidEvent has copy, drop {
        territory_id: ID,
        payer: address,
        owner: address,
        amount: u64
    }

    struct RunCompletedEvent has copy, drop {
        runner: address,
        distance: u64,
        xp_earned: u64,
        territories_claimed: u64
    }

    // ===== Init Function =====
    
    fun init(ctx: &mut TxContext) {
        let game_state = GameState {
            id: object::new(ctx),
            territories: table::new(ctx),
            total_territories: 0,
            total_xp_minted: 0,
            total_rent_paid: 0
        };
        transfer::share_object(game_state);
    }

    // ===== Public Functions =====
    
    /// Create a new user profile
    public entry fun create_profile(
        username: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let profile = UserProfile {
            id: object::new(ctx),
            owner: tx_context::sender(ctx),
            username: string::utf8(username),
            xp_balance: balance::zero(),
            total_distance: 0,
            territories_owned: 0,
            total_runs: 0,
            created_at: clock::timestamp_ms(clock)
        };
        transfer::transfer(profile, tx_context::sender(ctx));
    }

    /// Start a new run session
    public entry fun start_run(
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let session = RunSession {
            id: object::new(ctx),
            runner: tx_context::sender(ctx),
            start_time: clock::timestamp_ms(clock),
            end_time: 0,
            distance: 0,
            path: vector::empty(),
            xp_earned: 0,
            territories_crossed: vector::empty()
        };
        transfer::transfer(session, tx_context::sender(ctx));
    }

    /// Claim a territory after completing a run
    public entry fun claim_territory(
        game_state: &mut GameState,
        profile: &mut UserProfile,
        name: vector<u8>,
        coordinates: vector<Coordinate>,
        distance: u64,
        rent_price: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Validate territory size
        assert!(distance >= MIN_TERRITORY_SIZE, E_TERRITORY_TOO_SMALL);
        
        // Calculate XP earned
        let xp_earned = distance * XP_PER_METER;
        
        // Mint XP to user
        let xp = XP { amount: xp_earned };
        balance::join(&mut profile.xp_balance, balance::create_for_testing(xp));
        
        // Create territory NFT
        let territory = Territory {
            id: object::new(ctx),
            name: string::utf8(name),
            owner: tx_context::sender(ctx),
            coordinates,
            area: distance,
            rent_price,
            total_rent_collected: 0,
            claimed_at: clock::timestamp_ms(clock),
            visits: 0
        };
        
        let territory_id = object::id(&territory);
        
        // Update game state
        table::add(&mut game_state.territories, territory_id, tx_context::sender(ctx));
        game_state.total_territories = game_state.total_territories + 1;
        game_state.total_xp_minted = game_state.total_xp_minted + xp_earned;
        
        // Update user profile
        profile.territories_owned = profile.territories_owned + 1;
        profile.total_distance = profile.total_distance + distance;
        profile.total_runs = profile.total_runs + 1;
        
        // Emit event
        event::emit(TerritoryClaimedEvent {
            territory_id,
            owner: tx_context::sender(ctx),
            area: distance,
            xp_earned
        });
        
        // Transfer territory to owner
        transfer::transfer(territory, tx_context::sender(ctx));
    }

    /// Pay rent when entering someone's territory
    public entry fun pay_rent(
        game_state: &mut GameState,
        territory: &mut Territory,
        payer_profile: &mut UserProfile,
        owner_profile: &mut UserProfile,
        ctx: &mut TxContext
    ) {
        let rent_amount = territory.rent_price;
        
        // Check if payer has enough XP
        assert!(balance::value(&payer_profile.xp_balance) >= rent_amount, E_INSUFFICIENT_BALANCE);
        
        // Transfer XP from payer to owner
        let payment = balance::split(&mut payer_profile.xp_balance, rent_amount);
        balance::join(&mut owner_profile.xp_balance, payment);
        
        // Update territory stats
        territory.total_rent_collected = territory.total_rent_collected + rent_amount;
        territory.visits = territory.visits + 1;
        
        // Update game state
        game_state.total_rent_paid = game_state.total_rent_paid + rent_amount;
        
        // Emit event
        event::emit(RentPaidEvent {
            territory_id: object::id(territory),
            payer: tx_context::sender(ctx),
            owner: territory.owner,
            amount: rent_amount
        });
    }

    /// Apply penalty for declining to pay rent
    public entry fun apply_trespass_penalty(
        payer_profile: &mut UserProfile,
        territory: &Territory,
        ctx: &mut TxContext
    ) {
        let penalty_amount = territory.rent_price * PENALTY_MULTIPLIER;
        
        // Check if user has enough XP
        assert!(balance::value(&payer_profile.xp_balance) >= penalty_amount, E_INSUFFICIENT_BALANCE);
        
        // Burn the penalty XP
        let penalty = balance::split(&mut payer_profile.xp_balance, penalty_amount);
        balance::destroy_for_testing(penalty);
    }

    /// Complete a run and calculate rewards
    public entry fun complete_run(
        game_state: &mut GameState,
        profile: &mut UserProfile,
        session: RunSession,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let RunSession { 
            id, 
            runner, 
            start_time: _, 
            end_time: _, 
            distance, 
            path: _, 
            xp_earned, 
            territories_crossed: _ 
        } = session;
        
        // Verify runner
        assert!(runner == tx_context::sender(ctx), E_NOT_TERRITORY_OWNER);
        
        // Update profile
        profile.total_distance = profile.total_distance + distance;
        profile.total_runs = profile.total_runs + 1;
        
        // Mint bonus XP for completing run
        let bonus_xp = distance * XP_PER_METER / 2;
        let xp = XP { amount: bonus_xp };
        balance::join(&mut profile.xp_balance, balance::create_for_testing(xp));
        
        game_state.total_xp_minted = game_state.total_xp_minted + bonus_xp;
        
        // Emit event
        event::emit(RunCompletedEvent {
            runner: tx_context::sender(ctx),
            distance,
            xp_earned: xp_earned + bonus_xp,
            territories_claimed: 0
        });
        
        // Clean up session
        object::delete(id);
    }

    /// Transfer territory ownership
    public entry fun transfer_territory(
        territory: Territory,
        recipient: address,
        ctx: &mut TxContext
    ) {
        assert!(territory.owner == tx_context::sender(ctx), E_NOT_TERRITORY_OWNER);
        transfer::transfer(territory, recipient);
    }

    // ===== View Functions =====
    
    public fun get_user_xp(profile: &UserProfile): u64 {
        balance::value(&profile.xp_balance)
    }

    public fun get_territory_info(territory: &Territory): (String, address, u64, u64) {
        (territory.name, territory.owner, territory.area, territory.rent_price)
    }

    public fun get_game_stats(game_state: &GameState): (u64, u64, u64) {
        (game_state.total_territories, game_state.total_xp_minted, game_state.total_rent_paid)
    }

    // ===== Test Functions =====
    
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}