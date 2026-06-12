import type { ParameterDto } from "@private-2d-rigging-lab/package-format";

import { incrementAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { hasParameter } from "./graph-selectors.js";

export type AuthoringMutationErrorCode =
  | "duplicate_parameter"
  | "duplicate_source_asset"
  | "duplicate_source_layer"
  | "duplicate_drawable"
  | "duplicate_mesh"
  | "duplicate_part"
  | "missing_parent_part"
  | "part_cycle"
  | "root_part_move"
  | "root_part_drop"
  | "drawable_root_parent"
  | "duplicate_child_part"
  | "no_op_part_update"
  | "no_op_structure_order_move"
  | "missing_drop_target"
  | "part_has_child_parts"
  | "part_has_drawables"
  | "part_has_rig_controls"
  | "duplicate_keyform_set"
  | "missing_part"
  | "missing_source_asset"
  | "blocked_rights"
  | "provenance_asset_mismatch"
  | "rights_asset_mismatch"
  | "source_binary_ref_path_mismatch"
  | "source_binary_ref_provenance_mismatch"
  | "source_binary_ref_rights_mismatch"
  | "source_layer_asset_mismatch"
  | "missing_source_layer"
  | "missing_provenance_record"
  | "missing_rights_record"
  | "texture_preview_texture_mismatch"
  | "texture_preview_source_asset_mismatch"
  | "texture_preview_source_layer_mismatch"
  | "texture_preview_provenance_mismatch"
  | "texture_binary_ref_path_mismatch"
  | "texture_binary_ref_provenance_mismatch"
  | "texture_binary_ref_rights_mismatch"
  | "missing_drawable"
  | "invalid_drawable_display_name"
  | "invalid_drawable_opacity"
  | "no_op_drawable_update"
  | "missing_texture"
  | "no_op_drawable_part_update"
  | "no_op_drawable_texture_update"
  | "missing_draw_order_entry"
  | "duplicate_draw_order_entry"
  | "draw_order_structure_conflict"
  | "no_op_draw_order_update"
  | "no_op_runtime_visibility_update"
  | "missing_mask_drawable"
  | "missing_mask_target_drawable"
  | "duplicate_mask_drawable"
  | "duplicate_mask_target_drawable"
  | "empty_mask_relation"
  | "self_mask_relation"
  | "no_op_mask_relation_update"
  | "missing_mesh"
  | "missing_vertex"
  | "duplicate_vertex"
  | "invalid_vertex_insert_index"
  | "referenced_vertex"
  | "mesh_vertex_cardinality_mismatch"
  | "mesh_triangle_stable_id_count_mismatch"
  | "invalid_triangle_reference"
  | "degenerate_triangle"
  | "missing_triangle"
  | "duplicate_triangle"
  | "duplicate_triangle_vertex"
  | "missing_triangle_vertex"
  | "invalid_triangle_insert_index"
  | "topology_revision_mismatch"
  | "empty_vertex_delta"
  | "duplicate_vertex_delta"
  | "no_op_mesh_vertex_update"
  | "empty_uv_delta"
  | "duplicate_uv_delta"
  | "no_op_mesh_uv_update"
  | "missing_parameter"
  | "missing_keyform_target"
  | "unsupported_keyform_target_property"
  | "unsupported_keyform_composition_mode"
  | "invalid_warp_lattice_control_point_offsets_patch"
  | "duplicate_keyform_grid_axis_parameter"
  | "duplicate_keyform_grid_coordinate"
  | "duplicate_dynamics_group"
  | "missing_dynamics_group"
  | "missing_dynamics_driver_parameter"
  | "missing_dynamics_output_parameter"
  | "invalid_dynamics_driver_parameter_source"
  | "invalid_dynamics_output_parameter_source"
  | "duplicate_dynamics_driver"
  | "duplicate_dynamics_output_parameter"
  | "dynamics_output_used_as_driver"
  | "no_op_dynamics_group_update"
  | "duplicate_rig_control"
  | "missing_rig_control"
  | "invalid_rig_control_child_kind"
  | "invalid_rig_control_child_id"
  | "duplicate_rig_control_child"
  | "duplicate_rig_control_child_binding"
  | "rig_control_self_child"
  | "rig_control_cycle"
  | "rig_control_child_already_parented"
  | "rig_control_parent_child_mismatch"
  | "missing_rig_control_child_binding"
  | "illegal_rig_control_root_state"
  | "invalid_rig_control_display_name"
  | "invalid_rig_control_opacity_multiplier"
  | "unsupported_rig_control_update_field"
  | "rig_control_keyform_cardinality_conflict"
  | "no_op_rig_control_update"
  | "no_op_rig_control_child_binding"
  | "invalid_warp_lattice_bind_space"
  | "invalid_warp_lattice_domain_bounds"
  | "invalid_warp_lattice_grid"
  | "invalid_warp_lattice_rest_control_points"
  | "invalid_warp_lattice_interpolation"
  | "invalid_warp_deformer_transform_grid"
  | "invalid_warp_deformer_bezier_surface";

export class AuthoringMutationError extends Error {
  readonly code: AuthoringMutationErrorCode;

  constructor(code: AuthoringMutationErrorCode, message: string) {
    super(message);
    this.name = "AuthoringMutationError";
    this.code = code;
  }
}

export interface CreateParameterMutationResult {
  readonly session: AuthoringSession;
  readonly parameter: ParameterDto;
  readonly authoringRevision: AuthoringRevision;
}

export const createParameter = (
  session: AuthoringSession,
  parameter: ParameterDto
): CreateParameterMutationResult => {
  if (hasParameter(session.graph, parameter.parameterId)) {
    throw new AuthoringMutationError(
      "duplicate_parameter",
      `Parameter already exists: ${parameter.parameterId}`
    );
  }

  const storedParameter = structuredClone(parameter);
  session.graph.parameters.push(storedParameter);
  if (!session.graph.stableOrder.includes(storedParameter.parameterId)) {
    session.graph.stableOrder.push(storedParameter.parameterId);
  }

  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    parameter: storedParameter,
    authoringRevision: session.authoringRevision
  };
};
